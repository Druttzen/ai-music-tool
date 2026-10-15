//! Internal plugin provisioning. No system installers or external checkout discovery.
use std::process::Command;
use std::time::Duration;
use tauri::AppHandle;
use crate::{app_layout, process_progress, sidecar_userdata};

pub(crate) fn run_plugin_module(app: &AppHandle, module: &str, args: &[&str]) -> Result<String, String> {
    let python = sidecar_userdata::bootstrap_user_venv(app)?;
    let root = sidecar_userdata::user_sidecar_root(app)?;
    let pkg = sidecar_userdata::ensure_user_sidecar_pkg(app)?;
    let mut cmd = Command::new(python);
    cmd.args(["-m", module]).args(args).env("PYTHONPATH", &pkg);
    sidecar_userdata::apply_runtime_cache_env(&mut cmd, &root);
    let id = args.last().copied().unwrap_or("acestep");
    let output = process_progress::run_command_streaming(cmd, Duration::from_secs(2 * 3600), |line| {
        process_progress::emit_install_progress(app, id, "log", Some(line), None);
    })?;
    if output.status.success() {
          Ok(if args.first() == Some(&"deactivate") {
              format!("Internal {id} deactivated; cached files preserved")
          } else if id == "diffsinger" {
            "DiffSinger engine installed. Add your acoustic, variance and vocoder voice checkpoints to enable synthesis.".into()
        } else { format!("Internal {id} setup completed") })
    }
    else { Err(String::from_utf8_lossy(&output.stderr).lines().rev().take(12).collect::<Vec<_>>().into_iter().rev().collect::<Vec<_>>().join("\n")) }
}

pub(crate) fn install_acestep(app: &AppHandle) -> Result<String, String> {
    run_plugin_module(app, "ai_sidecar.internal_plugins", &["install", "acestep"])
}
pub(crate) fn uninstall_acestep(app: &AppHandle) -> Result<String, String> {
    // Deactivate first. Keep downloaded checkpoints for a later reactivation.
    let manifest = app_layout::addons_dir(Some(app))?.join("acestep/plugin.json");
    if manifest.exists() { std::fs::remove_file(manifest).map_err(|e| e.to_string())?; }
    sidecar_userdata::remove_installed_extra(app, "acestep");
    Ok("Internal ACE-Step plugin deactivated; cached models preserved".into())
}
