//! Install opt-in sidecar pip extras via checkout scripts or packaged user-data venv.

use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::Arc;
use std::time::Duration;

use serde::Serialize;
use tauri::AppHandle;

use crate::sidecar_manager::{resolve_sidecar_dir, SidecarManager};
use crate::sidecar_userdata::{
    checkout_venv_python, find_system_python_310_312, install_extra_into_user_venv,
    resolve_package_source, user_sidecar_root, user_venv_python,
};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SidecarExtraInstallResult {
    pub ok: bool,
    pub extra_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mode: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub install_hint: Option<String>,
}

fn npm_hint(extra_id: &str) -> String {
    format!("npm run sidecar:{extra_id}")
}

fn script_stem(extra_id: &str) -> Option<&'static str> {
    match extra_id {
        "stems" => Some("install-sidecar-stems"),
        "generate" => Some("install-sidecar-generate"),
        "classify" => Some("install-sidecar-classify"),
        "vision" => Some("install-sidecar-vision"),
        "cover" => Some("install-sidecar-cover"),
        "cover-ref" => Some("install-sidecar-cover-ref"),
        "vocal" => Some("install-sidecar-vocal"),
        "vocal-ml" => Some("install-sidecar-vocal-ml"),
        "vocal-rvc" => Some("install-sidecar-vocal-rvc"),
        _ => None,
    }
}

fn resolve_repo_root(sidecar_dir: &Path) -> Option<PathBuf> {
    sidecar_dir.parent().map(|p| p.to_path_buf())
}

fn resolve_install_script(repo_root: &Path, stem: &str) -> Option<PathBuf> {
    #[cfg(windows)]
    {
        let ps1 = repo_root.join("scripts").join(format!("{stem}.ps1"));
        if ps1.is_file() {
            return Some(ps1);
        }
    }
    #[cfg(not(windows))]
    {
        let sh = repo_root.join("scripts").join(format!("{stem}.sh"));
        if sh.is_file() {
            return Some(sh);
        }
    }
    let ps1 = repo_root.join("scripts").join(format!("{stem}.ps1"));
    let sh = repo_root.join("scripts").join(format!("{stem}.sh"));
    if cfg!(windows) && ps1.is_file() {
        Some(ps1)
    } else if sh.is_file() {
        Some(sh)
    } else if ps1.is_file() {
        Some(ps1)
    } else {
        None
    }
}

const INSTALL_TIMEOUT: Duration = Duration::from_secs(20 * 60);

fn kill_process(pid: u32) {
    #[cfg(windows)]
    {
        let _ = Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/T", "/F"])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
    }
    #[cfg(not(windows))]
    {
        let _ = Command::new("kill")
            .args(["-9", &format!("-{pid}")])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
    }
}

fn run_command_with_timeout(mut cmd: Command, timeout: Duration) -> Result<std::process::Output, String> {
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        cmd.process_group(0);
    }
    let child = cmd
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to run install script: {e}"))?;
    let pid = child.id();
    let (tx, rx) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        let _ = tx.send(child.wait_with_output());
    });
    match rx.recv_timeout(timeout) {
        Ok(Ok(output)) => Ok(output),
        Ok(Err(e)) => Err(format!("Failed to run install script: {e}")),
        Err(_) => {
            kill_process(pid);
            Err(format!(
                "Install timed out after {} minutes",
                timeout.as_secs() / 60
            ))
        }
    }
}

fn run_install_script(script: &Path, repo_root: &Path) -> Result<String, String> {
    let script_str = script.to_str().ok_or("Invalid script path")?;
    let output = if script
        .extension()
        .and_then(|e| e.to_str())
        .is_some_and(|e| e.eq_ignore_ascii_case("ps1"))
    {
        let mut cmd = Command::new("powershell");
        cmd.args([
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            script_str,
        ])
        .current_dir(repo_root);
        run_command_with_timeout(cmd, INSTALL_TIMEOUT)?
    } else {
        let mut cmd = Command::new("bash");
        cmd.arg(script_str).current_dir(repo_root);
        run_command_with_timeout(cmd, INSTALL_TIMEOUT)?
    };

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let combined = format!("{stdout}{stderr}");
    let tail: String = combined
        .lines()
        .rev()
        .take(12)
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect::<Vec<_>>()
        .join("\n");

    if output.status.success() {
        Ok(if tail.is_empty() {
            "Install finished".to_string()
        } else {
            tail
        })
    } else {
        Err(if tail.is_empty() {
            format!("Install failed (exit {})", output.status)
        } else {
            tail
        })
    }
}

fn fail(id: String, mode: &str, error: String, hint: String) -> SidecarExtraInstallResult {
    SidecarExtraInstallResult {
        ok: false,
        extra_id: id,
        mode: Some(mode.to_string()),
        message: None,
        error: Some(error),
        install_hint: Some(hint),
    }
}

fn install_via_checkout_scripts(
    manager: &Arc<SidecarManager>,
    id: &str,
    stem: &str,
    hint: &str,
) -> Option<SidecarExtraInstallResult> {
    let sidecar_dir = resolve_sidecar_dir()?;
    let _venv = checkout_venv_python(&sidecar_dir)?;
    let repo_root = resolve_repo_root(&sidecar_dir)?;
    let script = resolve_install_script(&repo_root, stem)?;

    Some(match run_install_script(&script, &repo_root) {
        Ok(tail) => {
            manager.restart();
            let _ = manager.wait_until_ready(Duration::from_secs(45));
            SidecarExtraInstallResult {
                ok: true,
                extra_id: id.to_string(),
                mode: Some("installed".to_string()),
                message: Some(format!("Installed — sidecar restarting. {tail}")),
                error: None,
                install_hint: Some(hint.to_string()),
            }
        }
        Err(err) => {
            let mode = if err.to_ascii_lowercase().contains("timed out") {
                "install-timeout"
            } else {
                "install-failed"
            };
            fail(id.to_string(), mode, err, hint.to_string())
        }
    })
}

fn install_sidecar_extra_blocking(
    app: AppHandle,
    manager: Arc<SidecarManager>,
    extra_id: String,
) -> SidecarExtraInstallResult {
    let id = extra_id.trim().to_string();
    let hint = npm_hint(&id);

    let Some(stem) = script_stem(&id) else {
        return fail(id, "unknown", "Unknown sidecar extra id".to_string(), hint);
    };

    // Prefer contributor checkout when a writable .venv already exists.
    if let Some(result) = install_via_checkout_scripts(&manager, &id, stem, &hint) {
        return result;
    }

    // Packaged / no checkout venv: bootstrap user-data venv + pip.
    match install_extra_into_user_venv(&app, &id) {
        Ok(tail) => {
            manager.restart();
            let _ = manager.wait_until_ready(Duration::from_secs(45));
            let tail_trim = tail
                .lines()
                .rev()
                .take(8)
                .collect::<Vec<_>>()
                .into_iter()
                .rev()
                .collect::<Vec<_>>()
                .join("\n");
            SidecarExtraInstallResult {
                ok: true,
                extra_id: id,
                mode: Some("installed".to_string()),
                message: Some(format!(
                    "Installed into user-data sidecar venv — restarting. {tail_trim}"
                )),
                error: None,
                install_hint: Some(hint),
            }
        }
        Err(err) => {
            let mode = if err.to_ascii_lowercase().contains("timed out") {
                "install-timeout"
            } else if err.to_ascii_lowercase().contains("need python")
                || err.to_ascii_lowercase().contains("package source not found")
            {
                "bundled-readonly"
            } else {
                "install-failed"
            };
            fail(id, mode, err, hint)
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SidecarExtraInstallEnv {
    pub mode: String,
    pub writable: bool,
    pub message: String,
}

fn probe_install_env(app: &AppHandle) -> SidecarExtraInstallEnv {
    if let Some(sidecar_dir) = resolve_sidecar_dir() {
        if checkout_venv_python(&sidecar_dir).is_some() {
            return SidecarExtraInstallEnv {
                mode: "writable".to_string(),
                writable: true,
                message: "Local ai-sidecar/.venv found — Install can run pip extras.".to_string(),
            };
        }
    }

    if let Ok(root) = user_sidecar_root(app) {
        if user_venv_python(&root).is_some() {
            return SidecarExtraInstallEnv {
                mode: "writable".to_string(),
                writable: true,
                message: "User-data sidecar venv found — Install can run pip extras.".to_string(),
            };
        }
    }

    let has_pkg = resolve_package_source(Some(app)).is_some();
    let has_py = find_system_python_310_312().is_some();
    if has_pkg && has_py {
        return SidecarExtraInstallEnv {
            mode: "user-data-bootstrap".to_string(),
            writable: true,
            message: "First Install will create a writable sidecar venv under app data (needs Python 3.10–3.12; may take several minutes)."
                .to_string(),
        };
    }

    if !has_py {
        return SidecarExtraInstallEnv {
            mode: "bundled-readonly".to_string(),
            writable: false,
            message: "Need Python 3.10–3.12 on PATH to install sidecar extras in packaged Studio (or use a local checkout with ai-sidecar/.venv)."
                .to_string(),
        };
    }

    SidecarExtraInstallEnv {
        mode: "bundled-readonly".to_string(),
        writable: false,
        message: "ai-sidecar package source not found — pip extras need bundle resources or a local checkout."
            .to_string(),
    }
}

#[tauri::command]
pub fn probe_sidecar_extra_install_env(app: AppHandle) -> SidecarExtraInstallEnv {
    probe_install_env(&app)
}

#[tauri::command]
pub async fn install_sidecar_extra(
    app: AppHandle,
    manager: tauri::State<'_, Arc<SidecarManager>>,
    extra_id: String,
) -> Result<SidecarExtraInstallResult, String> {
    let mgr = Arc::clone(manager.inner());
    tauri::async_runtime::spawn_blocking(move || install_sidecar_extra_blocking(app, mgr, extra_id))
        .await
        .map_err(|err| format!("Install task failed: {err}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn script_stem_covers_allowlist() {
        assert_eq!(script_stem("generate"), Some("install-sidecar-generate"));
        assert_eq!(script_stem("cover-ref"), Some("install-sidecar-cover-ref"));
        assert_eq!(script_stem("vocal-ml"), Some("install-sidecar-vocal-ml"));
        assert!(script_stem("nope").is_none());
    }
}
