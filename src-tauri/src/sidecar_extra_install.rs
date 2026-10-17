//! Install opt-in sidecar pip extras via checkout scripts or packaged user-data venv.

use std::sync::Arc;
use std::time::Duration;

use serde::Serialize;
use tauri::AppHandle;

use crate::app_layout;
use crate::process_progress::{
    emit_install_progress,
};
use crate::sidecar_manager::SidecarManager;
use crate::sidecar_userdata::{
    find_system_python_310_312, install_extra_into_user_venv,
    detect_installed_extras_from_venv, load_installed_extras, record_installed_extra,
    resolve_package_source, uninstall_extra_from_user_venv, user_sidecar_root, user_venv_python,
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
        "acestep" | "acest" => Some("install-sidecar-acestep"),
        "classify" => Some("install-sidecar-classify"),
        "vision" => Some("install-sidecar-vision"),
        "cover" => Some("install-sidecar-cover"),
        "cover-ref" => Some("install-sidecar-cover-ref"),
        "vocal" => Some("install-sidecar-vocal"),
        "vocal-ml" => Some("install-sidecar-vocal-ml"),
        "vocal-rvc" => Some("install-sidecar-vocal-rvc"),
        "mfa" | "mfa-align" => Some("install-sidecar-mfa"),
        "diffsinger" => Some("install-sidecar-diffsinger"),
        "java" => Some("install-sidecar-java"),
        "ffmpeg" => Some("install-sidecar-ffmpeg"),
        _ => None,
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

pub(crate) fn known_extra_ids() -> &'static [&'static str] {
    &[
        "stems",
        "stems-melband",
        "generate",
        "acestep",
        "classify",
        "vision",
        "cover",
        "cover-ref",
        "vocal",
        "vocal-ml",
        "vocal-rvc",
        "mfa", "diffsinger", "java", "ffmpeg",
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
                || err.to_ascii_lowercase().contains("python-embed")
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
    let id = match extra_id.trim() { "mfa-align" => "mfa", other => other }.to_string();
    let hint = npm_hint(&id);
    let Some(stem) = script_stem(&id) else {
        return fail(id, "unknown", "Unknown sidecar extra id".to_string(), hint);
    };

    emit_install_progress(app, &id, "start", Some("Starting extra install"), None);

    // All plugins belong to the app-managed data root, including development.
    let _ = (stem, skip_checkout);
    let managed_tool = ["mfa", "diffsinger", "java", "ffmpeg", "vocal-rvc"].contains(&id.as_str());
    let mut result = if managed_tool {
        match crate::internal_plugins::run_plugin_module(app, "ai_sidecar.managed_tools", &["install", &id]) {
            Ok(message) => SidecarExtraInstallResult {
                ok: true, extra_id: id.clone(), mode: Some("installed".into()),
                message: Some(message), error: None, install_hint: None,
            },
            Err(error) => fail(id.clone(), "install-failed", error, String::new()),
        }
    } else if id == "acestep" || id == "acest" {
        match crate::internal_plugins::install_acestep(app) {
            Ok(message) => SidecarExtraInstallResult {
                ok: true, extra_id: "acestep".into(), mode: Some("installed".into()),
                message: Some(message), error: None, install_hint: None,
            },
            Err(error) => fail(id.clone(), "install-failed", error, String::new()),
        }
    } else {
        install_into_user_venv_result(app, &id, &hint)
    };

    if result.ok {
        if let Err(err) = record_installed_extra(app, &id) {
            result.ok = false;
            result.mode = Some("activation-failed".to_string());
            result.error = Some(format!("Addon setup completed, but saving activation failed: {err}"));
        }
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
    if let Ok(root) = user_sidecar_root(app) {
        if user_venv_python(&root).is_some() {
            return SidecarExtraInstallEnv {
                mode: "writable".to_string(),
                writable: true,
                message: format!(
                    "Sidecar Python is next to the app at {} — Install can run pip extras.",
                    root.display()
                ),
            };
        }
    }

    let has_pkg = resolve_package_source(Some(app)).is_some();
    let has_embed = crate::python_embed::has_bundled_python_embed(Some(app));
    if has_pkg && has_embed {
        return SidecarExtraInstallEnv {
            mode: "user-data-bootstrap".to_string(),
            writable: true,
            message: format!(
                "First Install will unpack bundled Python next to the app at {} and install packages (may take several minutes). No system Python required.",
                app_layout::sidecar_dir(Some(app)).unwrap_or_else(|_| std::path::PathBuf::from("data/sidecar")).display()
            ),
        };
    }

    if has_pkg && !has_embed {
        // Checkout fallback: system Python still OK for contributors without the embed cache.
        if find_system_python_310_312().is_some() {
            return SidecarExtraInstallEnv {
                mode: "user-data-bootstrap".to_string(),
                writable: true,
                message: format!(
                    "First Install will create a writable sidecar venv next to the app at {} (checkout Python 3.10–3.12).",
                    app_layout::sidecar_dir(Some(app)).unwrap_or_else(|_| std::path::PathBuf::from("data/sidecar")).display()
                ),
            };
        }
        return SidecarExtraInstallEnv {
            mode: "bundled-readonly".to_string(),
            writable: false,
            message: if cfg!(windows) {
                "Bundled python-embed zip missing — run npm run fetch:python-embed before packaging, or use a checkout with Python 3.10–3.12."
            } else {
                "Python 3.10–3.12 is required on PATH to provision the app-managed sidecar environment."
            }.to_string(),
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
pub async fn prepare_musicgen_model(app: AppHandle, model_preset: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::sidecar_userdata::prepare_musicgen_model_in_user_venv(&app, &model_preset)
    }).await.map_err(|error| error.to_string())?
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

#[tauri::command]
pub async fn uninstall_sidecar_extra(
    app: AppHandle,
    manager: tauri::State<'_, Arc<SidecarManager>>,
    extra_id: String,
) -> Result<SidecarExtraInstallResult, String> {
    let id = match extra_id.trim() { "mfa-align" => "mfa", other => other }.to_string();
    if script_stem(&id).is_none() {
        return Ok(fail(
            id,
            "unknown",
            "Unknown sidecar extra id".to_string(),
            String::new(),
        ));
    }

    let mgr = Arc::clone(manager.inner());
    tauri::async_runtime::spawn_blocking(move || {
        mgr.stop();
        let result = if ["mfa", "diffsinger", "java", "ffmpeg", "vocal-rvc"].contains(&id.as_str()) {
            crate::internal_plugins::run_plugin_module(&app, "ai_sidecar.managed_tools", &["deactivate", &id])
                .and_then(|message| { crate::sidecar_userdata::deactivate_tracked_extra(&app, &id)?; Ok(message) })
        } else if id == "acestep" || id == "acest" {
            crate::internal_plugins::uninstall_acestep(&app)
        } else {
            uninstall_extra_from_user_venv(&app, &id)
        };
        mgr.restart();
        match result {
            Ok(log) => SidecarExtraInstallResult {
                ok: true,
                extra_id: id,
                mode: Some("uninstalled".to_string()),
                message: Some(if log.trim().is_empty() {
                    "Sidecar extra uninstalled".to_string()
                } else {
                    "Sidecar extra uninstalled".to_string()
                }),
                error: None,
                install_hint: None,
            },
            Err(error) => SidecarExtraInstallResult {
                ok: false,
                extra_id: id,
                mode: Some("uninstall-failed".to_string()),
                message: None,
                error: Some(error),
                install_hint: None,
            },
        }
    })
    .await
    .map_err(|err| format!("Uninstall task failed: {err}"))
}

#[tauri::command]
pub fn list_installed_sidecar_extras(app: AppHandle) -> Vec<String> {
    let mut ids = load_installed_extras(&app);
    for id in detect_installed_extras_from_venv(&app) {
        if !ids.iter().any(|existing| existing == &id) {
            ids.push(id);
        }
    }
    ids.sort();
    ids.dedup();
    ids
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn script_stem_covers_allowlist() {
        assert_eq!(script_stem("generate"), Some("install-sidecar-generate"));
        assert_eq!(script_stem("acestep"), Some("install-sidecar-acestep"));
        assert_eq!(script_stem("cover-ref"), Some("install-sidecar-cover-ref"));
        assert_eq!(script_stem("vocal-ml"), Some("install-sidecar-vocal-ml"));
        assert!(script_stem("nope").is_none());
    }

}
