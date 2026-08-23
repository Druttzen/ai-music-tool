//! Manages the Python AI sidecar process (FastAPI + librosa on localhost:8723).
//!
//! Development: spawns `ai-sidecar/.venv` via uvicorn.
//! Packaged builds: spawns the PyInstaller binary registered as a Tauri `externalBin`.

use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandChild;

const SIDECAR_PORT: u16 = 8723;
const HEALTH_URL: &str = "http://127.0.0.1:8723/health";
const POLL_INTERVAL: Duration = Duration::from_millis(400);
const HEALTH_TIMEOUT: Duration = Duration::from_millis(500);
/// Shut down managed sidecar after this many seconds without /analyze or /separate.
const SIDECAR_IDLE_EXIT_SEC: &str = "300";
const SPAWN_GRACE: Duration = Duration::from_secs(30);

#[derive(Debug, Serialize, Clone)]
pub struct SidecarStatus {
    pub ready: bool,
    pub spawned: bool,
    pub bundled: bool,
    pub port: u16,
    pub error: Option<String>,
}

enum SidecarChild {
    Process(Child),
    Bundled(CommandChild),
}

impl SidecarChild {
    fn kill(self) {
        match self {
            SidecarChild::Process(mut c) => {
                let _ = c.kill();
                let _ = c.wait();
            }
            SidecarChild::Bundled(c) => {
                let _ = c.kill();
            }
        }
    }

    fn has_exited(&mut self) -> bool {
        match self {
            SidecarChild::Process(c) => !matches!(c.try_wait(), Ok(None)),
            SidecarChild::Bundled(c) => !pid_alive(c.pid()),
        }
    }
}

struct SidecarInner {
    child: Option<SidecarChild>,
    ready: bool,
    spawned: bool,
    bundled: bool,
    error: Option<String>,
    auth_token: Option<String>,
    spawn_started: Option<Instant>,
    /// After a user-data venv child dies before ready, skip it and try the packaged binary.
    skip_user_venv: bool,
}

impl Default for SidecarInner {
    fn default() -> Self {
        Self {
            child: None,
            ready: false,
            spawned: false,
            bundled: false,
            error: None,
            auth_token: None,
            spawn_started: None,
            skip_user_venv: false,
        }
    }
}

pub struct SidecarManager {
    inner: Mutex<SidecarInner>,
    app: Mutex<Option<AppHandle>>,
}

impl Default for SidecarManager {
    fn default() -> Self {
        Self {
            inner: Mutex::new(SidecarInner::default()),
            app: Mutex::new(None),
        }
    }
}

impl SidecarManager {
    pub fn set_app_handle(&self, app: AppHandle) {
        if let Ok(mut guard) = self.app.lock() {
            *guard = Some(app);
        }
    }

    /// Start a background thread that polls `/health` without blocking Tauri commands.
    pub fn start_health_poller(self: &Arc<Self>) {
        static POLLER: OnceLock<()> = OnceLock::new();
        let manager = Arc::clone(self);
        POLLER.get_or_init(|| {
            std::thread::spawn(move || {
                loop {
                    std::thread::sleep(POLL_INTERVAL);
                    if let Ok(mut guard) = manager.inner.lock() {
                        reconcile_state(&mut guard);
                    }
                }
            });
        });
    }

    pub fn ensure_started(&self) {
        let mut guard = match self.inner.lock() {
            Ok(g) => g,
            Err(_) => return,
        };

        reconcile_state(&mut guard);

        // Do not skip spawn just because some other process answered /health.
        if guard.ready || guard.spawned {
            return;
        }

        let app = self.app.lock().ok().and_then(|g| g.clone());
        if guard.auth_token.is_none() {
            guard.auth_token = Some(new_sidecar_token());
        }
        let token = guard.auth_token.clone().unwrap_or_default();
        let skip_user_venv = guard.skip_user_venv;
        match spawn_sidecar_process(app.as_ref(), &token, skip_user_venv) {
            Ok((child, bundled)) => {
                guard.child = Some(child);
                guard.spawned = true;
                guard.bundled = bundled;
                guard.spawn_started = Some(Instant::now());
                guard.error = None;
            }
            Err(e) => {
                let probe = probe_health(Some(&token));
                if probe.up && probe.owned != Some(true) {
                    guard.error = Some(format!(
                        "port {SIDECAR_PORT} is in use by a process that does not have this app's sidecar token. Stop the other listener and retry."
                    ));
                } else {
                    guard.error = Some(e);
                }
            }
        }
    }

    /// Wait until the sidecar is ready. Network I/O runs only on the background poller.
    pub fn wait_until_ready(&self, timeout: Duration) -> bool {
        let deadline = Instant::now() + timeout;

        while Instant::now() < deadline {
            self.ensure_started();
            if let Ok(mut guard) = self.inner.lock() {
                reconcile_state(&mut guard);
                if guard.ready {
                    return true;
                }
                if guard.error.is_some() && !guard.spawned {
                    return false;
                }
            }
            std::thread::sleep(POLL_INTERVAL);
        }

        if let Ok(mut guard) = self.inner.lock() {
            if !guard.ready && guard.spawned {
                abandon_spawn(
                    &mut guard,
                    "AI sidecar did not become ready in time",
                );
            }
        }
        false
    }

    /// Snapshot of sidecar state — no blocking HTTP on the command thread.
    /// Does not include the sidecar auth token (see [`Self::auth_token`]).
    pub fn status(&self) -> SidecarStatus {
        let guard = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        SidecarStatus {
            ready: guard.ready,
            spawned: guard.spawned,
            bundled: guard.bundled,
            port: SIDECAR_PORT,
            error: guard.error.clone(),
        }
    }

    /// Sidecar token for authenticated renderer fetches. Not part of status polling.
    pub fn auth_token(&self) -> Option<String> {
        let guard = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        guard.auth_token.clone()
    }

    pub fn stop(&self) {
        let mut guard = match self.inner.lock() {
            Ok(g) => g,
            Err(_) => return,
        };
        if let Some(child) = guard.child.take() {
            child.kill();
        }
        guard.spawned = false;
        guard.ready = false;
        guard.bundled = false;
        guard.spawn_started = None;
    }

    /// Kill managed process (if any) and start again — used after pip extras install.
    pub fn restart(&self) {
        self.stop();
        if let Ok(mut guard) = self.inner.lock() {
            guard.skip_user_venv = false;
        }
        self.ensure_started();
    }
}

impl Drop for SidecarManager {
    fn drop(&mut self) {
        self.stop();
    }
}

fn pid_alive(pid: u32) -> bool {
    if pid == 0 {
        return false;
    }
    #[cfg(windows)]
    {
        const PROCESS_QUERY_LIMITED_INFORMATION: u32 = 0x1000;
        const STILL_ACTIVE: u32 = 259;
        #[link(name = "kernel32")]
        extern "system" {
            fn OpenProcess(access: u32, inherit: i32, pid: u32) -> *mut core::ffi::c_void;
            fn CloseHandle(handle: *mut core::ffi::c_void) -> i32;
            fn GetExitCodeProcess(handle: *mut core::ffi::c_void, exit_code: *mut u32) -> i32;
        }
        unsafe {
            let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
            if handle.is_null() {
                return false;
            }
            let mut code = 0u32;
            let ok = GetExitCodeProcess(handle, &mut code);
            CloseHandle(handle);
            ok != 0 && code == STILL_ACTIVE
        }
    }
    #[cfg(unix)]
    {
        #[link(name = "c")]
        extern "C" {
            fn kill(pid: i32, sig: i32) -> i32;
        }
        unsafe { kill(pid as i32, 0) == 0 }
    }
}

fn should_abandon_unhealthy_spawn(
    spawned: bool,
    ready: bool,
    healthy: bool,
    elapsed: Duration,
    grace: Duration,
) -> bool {
    spawned && !ready && !healthy && elapsed >= grace
}

fn abandon_spawn(guard: &mut SidecarInner, reason: &str) {
    let was_user_venv = !guard.bundled;
    if let Some(child) = guard.child.take() {
        child.kill();
    }
    guard.spawned = false;
    guard.ready = false;
    guard.bundled = false;
    guard.spawn_started = None;
    if was_user_venv {
        guard.skip_user_venv = true;
    }
    guard.error = Some(reason.to_string());
}

fn reconcile_state(guard: &mut SidecarInner) {
    let exited = guard.child.as_mut().is_some_and(SidecarChild::has_exited);
    if exited {
        if !guard.bundled && !guard.ready {
            guard.skip_user_venv = true;
        }
        guard.child = None;
        guard.spawned = false;
        guard.ready = false;
        guard.bundled = false;
        guard.spawn_started = None;
        return;
    }

    let probe = probe_health(guard.auth_token.as_deref());
    let elapsed = guard
        .spawn_started
        .map(|t| t.elapsed())
        .unwrap_or(Duration::ZERO);
    if should_abandon_unhealthy_spawn(guard.spawned, guard.ready, probe.up, elapsed, SPAWN_GRACE) {
        abandon_spawn(guard, "AI sidecar spawn never became healthy");
        return;
    }

    if guard.spawned {
        if guard.ready && !probe.up {
            if let Some(child) = guard.child.take() {
                child.kill();
            }
            guard.spawned = false;
            guard.ready = false;
            guard.bundled = false;
            guard.spawn_started = None;
        } else if !guard.ready && should_mark_ready(true, probe) {
            guard.ready = true;
            guard.error = None;
        }
        return;
    }

    let want_ready = should_mark_ready(false, probe);
    if want_ready {
        guard.ready = true;
        guard.error = None;
    } else {
        guard.ready = false;
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct HealthProbe {
    up: bool,
    /// Sidecar `/health` `owned` field: true only when our token matches.
    owned: Option<bool>,
}

/// Ready only for a process we spawned, or a listener that proves token ownership.
fn should_mark_ready(spawned: bool, probe: HealthProbe) -> bool {
    if !probe.up {
        return false;
    }
    if spawned {
        return probe.owned.unwrap_or(true);
    }
    probe.owned == Some(true)
}

fn probe_health(token: Option<&str>) -> HealthProbe {
    let client = match reqwest::blocking::Client::builder()
        .timeout(HEALTH_TIMEOUT)
        .build()
    {
        Ok(c) => c,
        Err(_) => return HealthProbe { up: false, owned: None },
    };
    let mut req = client.get(HEALTH_URL);
    if let Some(t) = token.filter(|s| !s.is_empty()) {
        req = req.header("X-AIMC-Sidecar-Token", t);
    }
    match req.send() {
        Ok(resp) if resp.status().is_success() => {
            let owned = resp
                .json::<serde_json::Value>()
                .ok()
                .and_then(|v| v.get("owned").and_then(|x| x.as_bool()));
            HealthProbe { up: true, owned }
        }
        _ => HealthProbe { up: false, owned: None },
    }
}

fn new_sidecar_token() -> String {
    uuid::Uuid::new_v4().to_string()
}

fn apply_spawn_stdio(cmd: &mut Command) {
    cmd.stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
}

fn sidecar_binary_names() -> &'static [&'static str] {
    #[cfg(windows)]
    {
        &["ai-sidecar.exe", "ai-sidecar-x86_64-pc-windows-msvc.exe"]
    }
    #[cfg(target_os = "macos")]
    {
        &[
            "ai-sidecar",
            "ai-sidecar-aarch64-apple-darwin",
            "ai-sidecar-x86_64-apple-darwin",
        ]
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        &["ai-sidecar", "ai-sidecar-x86_64-unknown-linux-gnu"]
    }
}

fn find_sidecar_binary_in_dir(dir: &Path) -> Option<PathBuf> {
    sidecar_binary_names()
        .iter()
        .map(|name| dir.join(name))
        .find(|path| path.is_file())
}

fn spawn_sidecar_exe(path: &Path, token: &str) -> Result<SidecarChild, String> {
    let port = SIDECAR_PORT.to_string();
    let mut cmd = Command::new(path);
    cmd.args([
        "--host",
        "127.0.0.1",
        "--port",
        &port,
        "--idle-exit-sec",
        SIDECAR_IDLE_EXIT_SEC,
    ])
    .env("AIMC_SIDECAR_TOKEN", token);
    apply_spawn_stdio(&mut cmd);
    let child = cmd
        .spawn()
        .map_err(|e| format!("failed to spawn sidecar exe ({}): {e}", path.display()))?;
    Ok(SidecarChild::Process(child))
}

fn spawn_bundled_sidecar(app: &AppHandle, token: &str) -> Result<SidecarChild, String> {
    let port = SIDECAR_PORT.to_string();
    let shell_result = app.shell().sidecar("ai-sidecar").and_then(|cmd| {
        cmd.args([
            "--host",
            "127.0.0.1",
            "--port",
            &port,
            "--idle-exit-sec",
            SIDECAR_IDLE_EXIT_SEC,
        ])
        .env("AIMC_SIDECAR_TOKEN", token)
        .spawn()
    });
    match shell_result {
        Ok((_rx, child)) => Ok(SidecarChild::Bundled(child)),
        Err(shell_err) => {
            let dir = std::env::current_exe()
                .ok()
                .and_then(|exe| exe.parent().map(Path::to_path_buf));
            let adjacent = dir.as_deref().and_then(find_sidecar_binary_in_dir);
            match adjacent {
                Some(path) => spawn_sidecar_exe(&path, token),
                None => Err(format!("bundled sidecar missing: {shell_err}")),
            }
        }
    }
}

pub(crate) fn resolve_sidecar_dir() -> Option<PathBuf> {
    let candidates = [
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../ai-sidecar"),
        std::env::current_dir()
            .ok()
            .map(|cwd| cwd.join("ai-sidecar"))
            .unwrap_or_default(),
        std::env::current_dir()
            .ok()
            .map(|cwd| cwd.join("../ai-sidecar"))
            .unwrap_or_default(),
    ];

    for dir in candidates {
        if dir.join("ai_sidecar/main.py").exists() {
            return dir.canonicalize().ok();
        }
    }
    None
}

fn resolve_python_executable(sidecar_dir: &Path) -> Option<PathBuf> {
    #[cfg(windows)]
    let venv_py = sidecar_dir.join(".venv/Scripts/python.exe");
    #[cfg(not(windows))]
    let venv_py = sidecar_dir.join(".venv/bin/python");

    if venv_py.exists() {
        return Some(venv_py);
    }

    // Never fall back to system Python: that process reports extras missing even when
    // ai-sidecar/.venv already has them installed (startup overlay then reinstalls / fails).
    None
}

fn spawn_dev_sidecar(token: &str) -> Result<SidecarChild, String> {
    let sidecar_dir = resolve_sidecar_dir()
        .ok_or_else(|| "ai-sidecar directory not found".to_string())?;

    let python = resolve_python_executable(&sidecar_dir).ok_or_else(|| {
        "Python sidecar venv not found - run: npm run sidecar".to_string()
    })?;

    let has_venv = sidecar_dir.join(".venv").exists();
    let mut cmd = Command::new(&python);
    cmd.args([
        "-m",
        "uvicorn",
        "ai_sidecar.main:app",
        "--host",
        "127.0.0.1",
        "--port",
        &SIDECAR_PORT.to_string(),
    ])
    .env("SIDECAR_IDLE_EXIT_SEC", SIDECAR_IDLE_EXIT_SEC)
    .env("AIMC_SIDECAR_TOKEN", token)
    .current_dir(&sidecar_dir);
    apply_spawn_stdio(&mut cmd);

    if !has_venv {
        cmd.env("PYTHONPATH", sidecar_dir.as_os_str());
    }

    let child = cmd
        .spawn()
        .map_err(|e| format!("failed to spawn dev sidecar ({python:?}): {e}"))?;
    Ok(SidecarChild::Process(child))
}

fn spawn_user_data_sidecar(app: &AppHandle, token: &str) -> Result<SidecarChild, String> {
    use crate::sidecar_userdata::{
        user_cache_dir, user_pkg_dir, user_sidecar_root_fallback, user_sidecar_runtime_root,
        user_venv_python,
    };

    let root = user_sidecar_runtime_root(app).or_else(|e| {
        user_sidecar_root_fallback().ok_or_else(|| format!("user sidecar root: {e}"))
    })?;
    let python = user_venv_python(&root).ok_or_else(|| "user-data venv python missing".to_string())?;
    let pkg = user_pkg_dir(&root);
    if !pkg.join("ai_sidecar/main.py").is_file() {
        return Err("user-data sidecar pkg incomplete".to_string());
    }
    let cache = user_cache_dir(&root);

    let mut cmd = Command::new(&python);
    cmd.args([
        "-m",
        "uvicorn",
        "ai_sidecar.main:app",
        "--host",
        "127.0.0.1",
        "--port",
        &SIDECAR_PORT.to_string(),
    ])
    .env("SIDECAR_IDLE_EXIT_SEC", SIDECAR_IDLE_EXIT_SEC)
    .env("AIMC_SIDECAR_TOKEN", token)
    .env("HF_HOME", cache.join("huggingface"))
    .env("TORCH_HOME", cache.join("torch"))
    .env("PYTHONPATH", &pkg)
    .current_dir(&pkg);
    apply_spawn_stdio(&mut cmd);

    let child = cmd
        .spawn()
        .map_err(|e| format!("failed to spawn user-data sidecar ({python:?}): {e}"))?;
    Ok(SidecarChild::Process(child))
}

fn user_data_sidecar_is_current(app: &AppHandle) -> bool {
    use crate::sidecar_userdata::{
        user_pkg_dir, user_sidecar_root_fallback, user_sidecar_runtime_root,
        user_sidecar_stamp_matches_package, user_venv_python,
    };

    let root = match user_sidecar_runtime_root(app) {
        Ok(p) => p,
        Err(_) => match user_sidecar_root_fallback() {
            Some(p) => p,
            None => return false,
        },
    };
    user_venv_python(&root).is_some()
        && user_pkg_dir(&root).join("ai_sidecar/main.py").is_file()
        && user_sidecar_stamp_matches_package(&root)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum SidecarSpawnStep {
    CurrentUserVenv,
    Dev,
    Bundled,
    AnyUserVenv,
}

fn sidecar_spawn_steps(skip_user_venv: bool, user_venv_current: bool, debug: bool) -> Vec<SidecarSpawnStep> {
    let mut steps = Vec::new();
    if !skip_user_venv && user_venv_current {
        steps.push(SidecarSpawnStep::CurrentUserVenv);
    }
    if debug {
        steps.push(SidecarSpawnStep::Dev);
    }
    steps.push(SidecarSpawnStep::Bundled);
    if !skip_user_venv {
        steps.push(SidecarSpawnStep::AnyUserVenv);
    }
    if !debug {
        steps.push(SidecarSpawnStep::Dev);
    }
    steps
}

/// Prefer a current user-data venv; then packaged binary (including `ai-sidecar.exe`
/// next to the app when Tauri's triple-suffixed sidecar name is missing); then a
/// leftover venv; then checkout uvicorn.
fn spawn_sidecar_process(
    app: Option<&AppHandle>,
    token: &str,
    skip_user_venv: bool,
) -> Result<(SidecarChild, bool), String> {
    let user_venv_current = app.map(user_data_sidecar_is_current).unwrap_or(false);
    let debug = cfg!(debug_assertions);
    let mut last_err: Option<String> = None;

    for step in sidecar_spawn_steps(skip_user_venv, user_venv_current, debug) {
        match step {
            SidecarSpawnStep::CurrentUserVenv | SidecarSpawnStep::AnyUserVenv => {
                if let Some(handle) = app {
                    match spawn_user_data_sidecar(handle, token) {
                        Ok(child) => return Ok((child, false)),
                        Err(e) => last_err = Some(e),
                    }
                }
            }
            SidecarSpawnStep::Dev => match spawn_dev_sidecar(token) {
                Ok(child) => return Ok((child, false)),
                Err(e) => last_err = Some(e),
            },
            SidecarSpawnStep::Bundled => {
                if let Some(handle) = app {
                    match spawn_bundled_sidecar(handle, token) {
                        Ok(child) => return Ok((child, true)),
                        Err(e) => last_err = Some(e),
                    }
                }
            }
        }
    }

    Err(last_err.unwrap_or_else(|| "failed to spawn AI sidecar".to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolves_sidecar_dir_in_dev_tree() {
        assert!(resolve_sidecar_dir().is_some());
    }

    #[test]
    fn bundled_exit_detection_is_not_hardcoded_false() {
        assert!(!pid_alive(0));
        assert!(pid_alive(std::process::id()));
    }

    #[test]
    fn abandons_spawn_that_never_becomes_healthy() {
        assert!(should_abandon_unhealthy_spawn(
            true,
            false,
            false,
            Duration::from_secs(30),
            SPAWN_GRACE,
        ));
        assert!(!should_abandon_unhealthy_spawn(
            true,
            false,
            false,
            Duration::from_secs(1),
            SPAWN_GRACE,
        ));
        assert!(!should_abandon_unhealthy_spawn(
            true,
            true,
            false,
            Duration::from_secs(60),
            SPAWN_GRACE,
        ));
    }

    #[test]
    fn packaged_spawn_skips_stale_user_venv_then_tries_bundled() {
        let steps = sidecar_spawn_steps(false, false, false);
        assert_eq!(
            steps,
            vec![
                SidecarSpawnStep::Bundled,
                SidecarSpawnStep::AnyUserVenv,
                SidecarSpawnStep::Dev,
            ]
        );
        let skipped = sidecar_spawn_steps(true, true, false);
        assert_eq!(skipped, vec![SidecarSpawnStep::Bundled, SidecarSpawnStep::Dev]);
        let current = sidecar_spawn_steps(false, true, false);
        assert_eq!(current.first(), Some(&SidecarSpawnStep::CurrentUserVenv));
        assert!(current.contains(&SidecarSpawnStep::Bundled));
    }

    #[test]
    fn finds_sidecar_exe_beside_app_without_target_triple() {
        let stamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("aimc-sidecar-exe-{stamp}"));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        assert!(find_sidecar_binary_in_dir(&dir).is_none());
        let name = sidecar_binary_names()[0];
        let path = dir.join(name);
        std::fs::write(&path, b"fake").unwrap();
        assert_eq!(find_sidecar_binary_in_dir(&dir).as_deref(), Some(path.as_path()));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn windows_py_launcher_flag_is_one_argv_token() {
        use crate::sidecar_userdata::py_launcher_version_flag;
        let flag = py_launcher_version_flag("3.12");
        assert_eq!(flag, "-3.12");
        assert_ne!(flag.as_str(), "-");
        assert!(!flag.contains(' '));
    }

    #[test]
    fn sidecar_status_json_omits_auth_token() {
        let status = SidecarStatus {
            ready: true,
            spawned: true,
            bundled: false,
            port: 8723,
            error: None,
        };
        let value = serde_json::to_value(&status).expect("serialize status");
        assert!(
            value.get("auth_token").is_none(),
            "sidecar_status must not expose the auth token to the webview"
        );
    }

    #[test]
    fn foreign_health_without_token_ownership_is_not_ready() {
        let unowned = HealthProbe {
            up: true,
            owned: Some(false),
        };
        let absent = HealthProbe {
            up: true,
            owned: None,
        };
        let owned = HealthProbe {
            up: true,
            owned: Some(true),
        };
        assert!(!should_mark_ready(false, unowned));
        assert!(!should_mark_ready(false, absent));
        assert!(should_mark_ready(false, owned));
        assert!(should_mark_ready(true, absent));
        assert!(should_mark_ready(true, owned));
        assert!(!should_mark_ready(
            true,
            HealthProbe {
                up: true,
                owned: Some(false)
            }
        ));
        assert!(!should_mark_ready(
            false,
            HealthProbe {
                up: false,
                owned: Some(true)
            }
        ));
    }
}
