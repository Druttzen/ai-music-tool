//! Install opt-in sidecar pip extras via existing npm/scripts installers when a writable venv exists.

use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Arc;
use std::time::Duration;

use serde::Serialize;
use crate::sidecar_manager::{resolve_sidecar_dir, SidecarManager};

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

fn venv_python(sidecar_dir: &Path) -> Option<PathBuf> {
    #[cfg(windows)]
    let py = sidecar_dir.join(".venv/Scripts/python.exe");
    #[cfg(not(windows))]
    let py = sidecar_dir.join(".venv/bin/python");
    if py.is_file() {
        Some(py)
    } else {
        None
    }
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
    // Cross-fallback for contributor machines
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

fn run_install_script(script: &Path, repo_root: &Path) -> Result<String, String> {
    let output = if script
        .extension()
        .and_then(|e| e.to_str())
        .is_some_and(|e| e.eq_ignore_ascii_case("ps1"))
    {
        Command::new("powershell")
            .args([
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                script.to_str().ok_or("Invalid script path")?,
            ])
            .current_dir(repo_root)
            .output()
            .map_err(|e| format!("Failed to run install script: {e}"))?
    } else {
        Command::new("bash")
            .arg(script.to_str().ok_or("Invalid script path")?)
            .current_dir(repo_root)
            .output()
            .map_err(|e| format!("Failed to run install script: {e}"))?
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

#[tauri::command]
pub fn install_sidecar_extra(
    manager: tauri::State<'_, Arc<SidecarManager>>,
    extra_id: String,
) -> SidecarExtraInstallResult {
    let id = extra_id.trim().to_string();
    let hint = npm_hint(&id);

    let Some(stem) = script_stem(&id) else {
        return SidecarExtraInstallResult {
            ok: false,
            extra_id: id,
            mode: Some("unknown".to_string()),
            message: None,
            error: Some("Unknown sidecar extra id".to_string()),
            install_hint: Some(hint),
        };
    };

    let Some(sidecar_dir) = resolve_sidecar_dir() else {
        return SidecarExtraInstallResult {
            ok: false,
            extra_id: id,
            mode: Some("bundled-readonly".to_string()),
            message: None,
            error: Some(
                "ai-sidecar source not found — pip extras need a local checkout with .venv"
                    .to_string(),
            ),
            install_hint: Some(hint),
        };
    };

    if venv_python(&sidecar_dir).is_none() {
        return SidecarExtraInstallResult {
            ok: false,
            extra_id: id,
            mode: Some("bundled-readonly".to_string()),
            message: None,
            error: Some(
                "No writable ai-sidecar/.venv — packaged Studio cannot pip-install extras. Run the npm hint in a clone, or create the venv first."
                    .to_string(),
            ),
            install_hint: Some(hint),
        };
    }

    let Some(repo_root) = resolve_repo_root(&sidecar_dir) else {
        return SidecarExtraInstallResult {
            ok: false,
            extra_id: id,
            mode: Some("error".to_string()),
            message: None,
            error: Some("Could not resolve repository root".to_string()),
            install_hint: Some(hint),
        };
    };

    let Some(script) = resolve_install_script(&repo_root, stem) else {
        return SidecarExtraInstallResult {
            ok: false,
            extra_id: id.clone(),
            mode: Some("missing-script".to_string()),
            message: None,
            error: Some(format!("Install script missing for {id}")),
            install_hint: Some(hint),
        };
    };

    match run_install_script(&script, &repo_root) {
        Ok(tail) => {
            manager.restart();
            let _ = manager.wait_until_ready(Duration::from_secs(45));
            SidecarExtraInstallResult {
                ok: true,
                extra_id: id,
                mode: Some("installed".to_string()),
                message: Some(format!("Installed — sidecar restarting. {tail}")),
                error: None,
                install_hint: Some(hint),
            }
        }
        Err(err) => SidecarExtraInstallResult {
            ok: false,
            extra_id: id,
            mode: Some("install-failed".to_string()),
            message: None,
            error: Some(err),
            install_hint: Some(hint),
        },
    }
}
