//! Install opt-in sidecar pip extras via checkout scripts or packaged user-data venv.

use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Arc;
use std::time::Duration;

use serde::Serialize;
use tauri::AppHandle;

use crate::app_layout;
use crate::process_progress::{
    emit_install_progress, parse_pip_progress_bytes, run_command_streaming,
};
use crate::sidecar_manager::{resolve_sidecar_dir, SidecarManager};
use crate::sidecar_userdata::{
    checkout_venv_python, find_system_python_310_312, install_extra_into_user_venv,
    record_installed_extra, resolve_package_source, user_sidecar_root, user_venv_python,
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
        "stems-melband" => Some("install-sidecar-stems-melband"),
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

/// PowerShell Join-Path rejects Windows verbatim (`\\?\`) paths.
fn for_child_process(path: &Path) -> PathBuf {
    let raw = path.to_string_lossy();
    if let Some(rest) = raw.strip_prefix(r"\\?\") {
        PathBuf::from(rest)
    } else {
        path.to_path_buf()
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

fn run_install_script(app: &AppHandle, extra_id: &str, script: &Path, repo_root: &Path) -> Result<String, String> {
    let script = for_child_process(script);
    let repo_root = for_child_process(repo_root);
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
        .env("PYTHONUNBUFFERED", "1")
        .env("PIP_PROGRESS_BAR", "on")
        .current_dir(repo_root);
        run_command_streaming(cmd, INSTALL_TIMEOUT, |line| {
            emit_install_progress(
                app,
                extra_id,
                "log",
                Some(line),
                parse_pip_progress_bytes(line),
            );
        })?
    } else {
        let mut cmd = Command::new("bash");
        cmd.arg(script_str)
            .env("PYTHONUNBUFFERED", "1")
            .env("PIP_PROGRESS_BAR", "on")
            .current_dir(repo_root);
        run_command_streaming(cmd, INSTALL_TIMEOUT, |line| {
            emit_install_progress(
                app,
                extra_id,
                "log",
                Some(line),
                parse_pip_progress_bytes(line),
            );
        })?
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
    app: &AppHandle,
    id: &str,
    stem: &str,
    hint: &str,
) -> Option<SidecarExtraInstallResult> {
    let sidecar_dir = resolve_sidecar_dir()?;
    let _venv = checkout_venv_python(&sidecar_dir)?;
    let repo_root = resolve_repo_root(&sidecar_dir)?;
    let script = resolve_install_script(&repo_root, stem)?;

    Some(match run_install_script(app, id, &script, &repo_root) {
        Ok(tail) => SidecarExtraInstallResult {
            ok: true,
            extra_id: id.to_string(),
            mode: Some("installed".to_string()),
            message: Some(format!("Installed — sidecar restarting. {tail}")),
            error: None,
            install_hint: Some(hint.to_string()),
        },
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

pub(crate) fn known_extra_ids() -> &'static [&'static str] {
    &[
        "stems",
        "stems-melband",
        "generate",
        "classify",
        "vision",
        "cover",
        "cover-ref",
        "vocal",
        "vocal-ml",
        "vocal-rvc",
    ]
}

/// Install one extra without stopping/starting the sidecar (caller owns lifecycle).
pub(crate) fn install_one_sidecar_extra(app: &AppHandle, extra_id: &str) -> SidecarExtraInstallResult {
    install_one_sidecar_extra_inner(app, extra_id, false)
}

/// Re-pip an already-installed extra into the user venv (`pip install -U`).
pub(crate) fn upgrade_one_sidecar_extra(app: &AppHandle, extra_id: &str) -> SidecarExtraInstallResult {
    install_one_sidecar_extra_inner(app, extra_id, true)
}

fn install_into_user_venv_result(app: &AppHandle, id: &str, hint: &str) -> SidecarExtraInstallResult {
    match install_extra_into_user_venv(app, id) {
        Ok(tail) => {
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
                extra_id: id.to_string(),
                mode: Some("installed".to_string()),
                message: Some(format!(
                    "Installed into user-data sidecar venv — restarting. {tail_trim}"
                )),
                error: None,
                install_hint: Some(hint.to_string()),
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
            fail(id.to_string(), mode, err, hint.to_string())
        }
    }
}

fn install_one_sidecar_extra_inner(
    app: &AppHandle,
    extra_id: &str,
    skip_checkout: bool,
) -> SidecarExtraInstallResult {
    let id = extra_id.trim().to_string();
    let hint = npm_hint(&id);
    let Some(stem) = script_stem(&id) else {
        return fail(id, "unknown", "Unknown sidecar extra id".to_string(), hint);
    };

    emit_install_progress(app, &id, "start", Some("Starting extra install"), None);

    let result = if skip_checkout {
        install_into_user_venv_result(app, &id, &hint)
    } else if let Some(result) = install_via_checkout_scripts(app, &id, stem, &hint) {
        result
    } else {
        install_into_user_venv_result(app, &id, &hint)
    };

    if result.ok {
        record_installed_extra(app, &id);
    }
    emit_install_progress(
        app,
        &id,
        if result.ok { "done" } else { "error" },
        result.message.as_deref().or(result.error.as_deref()),
        None,
    );
    result
}

fn install_sidecar_extra_blocking(
    app: AppHandle,
    manager: Arc<SidecarManager>,
    extra_id: String,
) -> SidecarExtraInstallResult {
    let id = extra_id.trim().to_string();
    if script_stem(&id).is_none() {
        let hint = npm_hint(&id);
        return fail(id, "unknown", "Unknown sidecar extra id".to_string(), hint);
    }

    // Release venv file locks before pip (especially Windows). Restart after either outcome.
    manager.stop();
    let result = install_one_sidecar_extra(&app, &id);
    manager.restart();
    if result.ok {
        let _ = manager.wait_until_ready(Duration::from_secs(45));
    }
    result
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
                message: format!(
                    "Sidecar extras venv is next to the app at {} — Install can run pip extras.",
                    root.display()
                ),
            };
        }
    }

    let has_pkg = resolve_package_source(Some(app)).is_some();
    let has_py = find_system_python_310_312().is_some();
    if has_pkg && has_py {
        return SidecarExtraInstallEnv {
            mode: "user-data-bootstrap".to_string(),
            writable: true,
            message: format!(
                "First Install will create a writable sidecar venv next to the app at {} (needs Python 3.10–3.12; may take several minutes).",
                app_layout::sidecar_dir(Some(app)).unwrap_or_else(|_| std::path::PathBuf::from("data/sidecar")).display()
            ),
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
    use std::path::PathBuf;

    #[test]
    fn script_stem_covers_allowlist() {
        assert_eq!(script_stem("generate"), Some("install-sidecar-generate"));
        assert_eq!(script_stem("cover-ref"), Some("install-sidecar-cover-ref"));
        assert_eq!(script_stem("vocal-ml"), Some("install-sidecar-vocal-ml"));
        assert!(script_stem("nope").is_none());
    }

    #[test]
    fn strips_windows_verbatim_prefix_for_powershell() {
        let verbatim = PathBuf::from(r"\\?\F:\ai-music-tool\scripts\install-sidecar-vision.ps1");
        assert_eq!(
            for_child_process(&verbatim),
            PathBuf::from(r"F:\ai-music-tool\scripts\install-sidecar-vision.ps1")
        );
        let normal = PathBuf::from(r"F:\ai-music-tool");
        assert_eq!(for_child_process(&normal), normal);
    }
}
