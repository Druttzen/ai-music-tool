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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub auth_token: Option<String>,
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

        if guard.ready || guard.spawned {
            return;
        }

        let app = self.app.lock().ok().and_then(|g| g.clone());
        if guard.auth_token.is_none() {
            guard.auth_token = Some(new_sidecar_token());
        }
        let token = guard.auth_token.clone().unwrap_or_default();
        match spawn_sidecar_process(app.as_ref(), &token) {
            Ok((child, bundled)) => {
                guard.child = Some(child);
                guard.spawned = true;
                guard.bundled = bundled;
                guard.spawn_started = Some(Instant::now());
                guard.error = None;
            }
            Err(e) => {
                guard.error = Some(e);
            }
        }
    }

    /// Wait until the sidecar is ready. Network I/O runs only on the background poller.
    pub fn wait_until_ready(&self, timeout: Duration) -> bool {
        self.ensure_started();
        let deadline = Instant::now() + timeout;

        while Instant::now() < deadline {
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
    pub fn status(&self) -> SidecarStatus {
        let guard = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        SidecarStatus {
            ready: guard.ready,
            spawned: guard.spawned,
            bundled: guard.bundled,
            port: SIDECAR_PORT,
            error: guard.error.clone(),
            auth_token: guard.auth_token.clone(),
        }
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
    if let Some(child) = guard.child.take() {
        child.kill();
    }
    guard.spawned = false;
    guard.ready = false;
    guard.bundled = false;
    guard.spawn_started = None;
    guard.error = Some(reason.to_string());
}

fn reconcile_state(guard: &mut SidecarInner) {
    let exited = guard.child.as_mut().is_some_and(SidecarChild::has_exited);
    if exited {
        guard.child = None;
        guard.spawned = false;
        guard.ready = false;
        guard.bundled = false;
        guard.spawn_started = None;
        return;
    }

    let healthy = health_check();
    let elapsed = guard
        .spawn_started
        .map(|t| t.elapsed())
        .unwrap_or(Duration::ZERO);
    if should_abandon_unhealthy_spawn(guard.spawned, guard.ready, healthy, elapsed, SPAWN_GRACE) {
        abandon_spawn(guard, "AI sidecar spawn never became healthy");
        return;
    }

    if guard.spawned {
        if guard.ready && !healthy {
            if let Some(child) = guard.child.take() {
                child.kill();
            }
            guard.spawned = false;
            guard.ready = false;
            guard.bundled = false;
            guard.spawn_started = None;
        } else if !guard.ready && healthy {
            guard.ready = true;
            guard.error = None;
        }
        return;
    }

    if healthy {
        guard.ready = true;
        guard.error = None;
    } else {
        guard.ready = false;
    }
}

fn health_check() -> bool {
    reqwest::blocking::Client::builder()
        .timeout(HEALTH_TIMEOUT)
        .build()
        .ok()
        .and_then(|c| c.get(HEALTH_URL).send().ok())
        .map(|r| r.status().is_success())
        .unwrap_or(false)
}

fn new_sidecar_token() -> String {
    uuid::Uuid::new_v4().to_string()
}

fn spawn_bundled_sidecar(app: &AppHandle, token: &str) -> Result<SidecarChild, String> {
    let port = SIDECAR_PORT.to_string();
    let (_rx, child) = app
        .shell()
        .sidecar("ai-sidecar")
        .map_err(|e| format!("bundled sidecar missing: {e}"))?
        .args([
            "--host",
            "127.0.0.1",
            "--port",
            &port,
            "--idle-exit-sec",
            SIDECAR_IDLE_EXIT_SEC,
        ])
        .env("AIMC_SIDECAR_TOKEN", token)
        .spawn()
        .map_err(|e| format!("failed to spawn bundled sidecar: {e}"))?;
    Ok(SidecarChild::Bundled(child))
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

    #[cfg(windows)]
    {
        use crate::sidecar_userdata::py_launcher_version_flag;
        for v in ["3.12", "3.11", "3.10"] {
            let flag = py_launcher_version_flag(v);
            if let Ok(out) = Command::new("py")
                .args([&flag, "-c", "import sys; print(sys.executable)"])
                .output()
            {
                if out.status.success() {
                    let path = String::from_utf8_lossy(&out.stdout).trim().to_string();
                    if !path.is_empty() && Path::new(&path).exists() {
                        return Some(PathBuf::from(path));
                    }
                }
            }
        }
    }

    #[cfg(not(windows))]
    {
        for name in ["python3.12", "python3.11", "python3.10", "python3"] {
            if Command::new(name)
                .arg("--version")
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .status()
                .map(|s| s.success())
                .unwrap_or(false)
            {
                return Some(PathBuf::from(name));
            }
        }
    }

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
    .current_dir(&sidecar_dir)
    .stdin(Stdio::null())
    .stdout(Stdio::null())
    .stderr(Stdio::null());

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
        user_cache_dir, user_pkg_dir, user_sidecar_root, user_sidecar_root_fallback, user_venv_python,
    };

    let root = user_sidecar_root(app).or_else(|e| {
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
    .current_dir(&pkg)
    .stdin(Stdio::null())
    .stdout(Stdio::null())
    .stderr(Stdio::null());

    let child = cmd
        .spawn()
        .map_err(|e| format!("failed to spawn user-data sidecar ({python:?}): {e}"))?;
    Ok(SidecarChild::Process(child))
}

/// Prefer user-data venv when present; then debug checkout; then packaged binary.
fn spawn_sidecar_process(app: Option<&AppHandle>, token: &str) -> Result<(SidecarChild, bool), String> {
    if let Some(handle) = app {
        if let Ok(child) = spawn_user_data_sidecar(handle, token) {
            return Ok((child, false));
        }
    }

    #[cfg(debug_assertions)]
    {
        if let Ok(child) = spawn_dev_sidecar(token) {
            return Ok((child, false));
        }
    }

    if let Some(handle) = app {
        if let Ok(child) = spawn_bundled_sidecar(handle, token) {
            return Ok((child, true));
        }
    }
    Ok((spawn_dev_sidecar(token)?, false))
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
    fn windows_py_launcher_flag_is_one_argv_token() {
        use crate::sidecar_userdata::py_launcher_version_flag;
        let flag = py_launcher_version_flag("3.12");
        assert_eq!(flag, "-3.12");
        assert_ne!(flag.as_str(), "-");
        assert!(!flag.contains(' '));
    }
}
