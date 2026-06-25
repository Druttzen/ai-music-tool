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
            SidecarChild::Bundled(_) => false,
        }
    }
}

struct SidecarInner {
    child: Option<SidecarChild>,
    ready: bool,
    spawned: bool,
    bundled: bool,
    error: Option<String>,
}

impl Default for SidecarInner {
    fn default() -> Self {
        Self {
            child: None,
            ready: false,
            spawned: false,
            bundled: false,
            error: None,
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
        match spawn_sidecar_process(app.as_ref()) {
            Ok((child, bundled)) => {
                guard.child = Some(child);
                guard.spawned = true;
                guard.bundled = bundled;
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
                guard.error = Some("AI sidecar did not become ready in time".to_string());
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
    }
}

impl Drop for SidecarManager {
    fn drop(&mut self) {
        self.stop();
    }
}

fn reconcile_state(guard: &mut SidecarInner) {
    if let Some(ref mut child) = guard.child {
        if child.has_exited() {
            guard.child = None;
            guard.spawned = false;
            guard.ready = false;
            guard.bundled = false;
            return;
        }
    }

    let healthy = health_check();

    if guard.spawned {
        if guard.ready && !healthy {
            guard.child = None;
            guard.spawned = false;
            guard.ready = false;
            guard.bundled = false;
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

fn spawn_bundled_sidecar(app: &AppHandle) -> Result<SidecarChild, String> {
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
        .spawn()
        .map_err(|e| format!("failed to spawn bundled sidecar: {e}"))?;
    Ok(SidecarChild::Bundled(child))
}

fn resolve_sidecar_dir() -> Option<PathBuf> {
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
        for v in ["3.12", "3.11", "3.10"] {
            if let Ok(out) = Command::new("py")
                .args(["-", v, "-c", "import sys; print(sys.executable)"])
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

fn spawn_dev_sidecar() -> Result<SidecarChild, String> {
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

/// Prefer dev venv in debug builds; packaged binary in release.
fn spawn_sidecar_process(app: Option<&AppHandle>) -> Result<(SidecarChild, bool), String> {
    #[cfg(debug_assertions)]
    {
        if let Ok(child) = spawn_dev_sidecar() {
            return Ok((child, false));
        }
    }

    if let Some(handle) = app {
        if let Ok(child) = spawn_bundled_sidecar(handle) {
            return Ok((child, true));
        }
    }
    Ok((spawn_dev_sidecar()?, false))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolves_sidecar_dir_in_dev_tree() {
        assert!(resolve_sidecar_dir().is_some());
    }
}
