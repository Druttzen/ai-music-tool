//! Signed Tauri Studio updates from the latest GitHub release.

use serde::Serialize;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tauri_plugin_updater::UpdaterExt;

const STUDIO_UPDATE_PROGRESS_EVENT: &str = "studio-component-update-progress";

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

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DownloadProgressPayload {
    phase: String,
    item: String,
    message: String,
    pct: Option<u32>,
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
    let app_progress = app.clone();
    let downloaded = Arc::new(AtomicU64::new(0));
    let downloaded_cb = Arc::clone(&downloaded);
    if let Err(error) = update
        .download_and_install(
            move |chunk_len, content_len| {
                let total_downloaded =
                    downloaded_cb.fetch_add(chunk_len as u64, Ordering::Relaxed) + chunk_len as u64;
                let pct = content_len
                    .filter(|total| *total > 0)
                    .map(|total| ((total_downloaded.min(total) * 100) / total) as u32);
                let message = match content_len {
                    Some(total) if total > 0 => {
                        format!("Downloading Studio update… {total_downloaded}/{total} bytes")
                    }
                    _ => format!("Downloading Studio update… {total_downloaded} bytes"),
                };
                let _ = app_progress.emit(
                    STUDIO_UPDATE_PROGRESS_EVENT,
                    DownloadProgressPayload {
                        phase: "studio-download".to_string(),
                        item: "studio".to_string(),
                        message,
                        pct: pct.map(|p| 85 + (p.min(100) * 14 / 100)),
                    },
                );
            },
            || {
                let _ = app.emit(
                    STUDIO_UPDATE_PROGRESS_EVENT,
                    DownloadProgressPayload {
                        phase: "studio-install".to_string(),
                        item: "studio".to_string(),
                        message: "Installing Studio update…".to_string(),
                        pct: Some(99),
                    },
                );
            },
        )
        .await
    {
        return StudioUpdateCheckResult::error(current_version, error);
    }

    let result = StudioUpdateCheckResult {
        ok: true,
        available: true,
        version: Some(version),
        current_version,
        notes,
        error: None,
    };

    #[cfg(not(target_os = "windows"))]
    {
        let _ = &result;
        app.restart();
    }

    #[cfg(target_os = "windows")]
    result
}
