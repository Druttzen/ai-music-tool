//! Signed Tauri Studio updates from the latest GitHub release.

use serde::Serialize;
use tauri::AppHandle;
use tauri_plugin_updater::UpdaterExt;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioUpdateCheckResult {
    pub ok: bool,
    pub available: bool,
    pub version: Option<String>,
    pub current_version: String,
    pub notes: Option<String>,
    pub error: Option<String>,
}

impl StudioUpdateCheckResult {
    fn error(current_version: String, error: impl ToString) -> Self {
        Self {
            ok: false,
            available: false,
            version: None,
            current_version,
            notes: None,
            error: Some(error.to_string()),
        }
    }
}

#[tauri::command]
pub async fn check_studio_update(app: AppHandle) -> StudioUpdateCheckResult {
    let current_version = app.package_info().version.to_string();
    let updater = match app.updater() {
        Ok(updater) => updater,
        Err(error) => return StudioUpdateCheckResult::error(current_version, error),
    };

    match updater.check().await {
        Ok(Some(update)) => StudioUpdateCheckResult {
            ok: true,
            available: true,
            version: Some(update.version),
            current_version,
            notes: update.body,
            error: None,
        },
        Ok(None) => StudioUpdateCheckResult {
            ok: true,
            available: false,
            version: None,
            current_version,
            notes: None,
            error: None,
        },
        Err(error) => StudioUpdateCheckResult::error(current_version, error),
    }
}

#[tauri::command]
pub async fn install_studio_update(app: AppHandle) -> StudioUpdateCheckResult {
    let current_version = app.package_info().version.to_string();
    let updater = match app.updater() {
        Ok(updater) => updater,
        Err(error) => return StudioUpdateCheckResult::error(current_version, error),
    };
    let update = match updater.check().await {
        Ok(Some(update)) => update,
        Ok(None) => {
            return StudioUpdateCheckResult {
                ok: true,
                available: false,
                version: None,
                current_version,
                notes: None,
                error: None,
            }
        }
        Err(error) => return StudioUpdateCheckResult::error(current_version, error),
    };

    let version = update.version.clone();
    let notes = update.body.clone();
    if let Err(error) = update.download_and_install(|_, _| {}, || {}).await {
        return StudioUpdateCheckResult::error(current_version, error);
    }

    #[cfg(not(target_os = "windows"))]
    app.restart();

    #[cfg(target_os = "windows")]
    StudioUpdateCheckResult {
        ok: true,
        available: true,
        version: Some(version),
        current_version,
        notes,
        error: None,
    }
}
