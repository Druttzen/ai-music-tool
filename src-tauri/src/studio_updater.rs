//! Signed Tauri Studio updates from the latest GitHub release.

use serde::Serialize;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tauri_plugin_updater::UpdaterExt;

const STUDIO_UPDATE_PROGRESS_EVENT: &str = "studio-component-update-progress";
const LATEST_JSON_URL: &str =
    "https://github.com/Druttzen/ai-music-tool/releases/latest/download/latest.json";
const CHECK_TIMEOUT: Duration = Duration::from_secs(15);
const DOWNLOAD_TIMEOUT: Duration = Duration::from_secs(8 * 60);

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

    fn current(current_version: String) -> Self {
        Self {
            ok: true,
            available: false,
            version: None,
            current_version,
            notes: None,
            error: None,
        }
    }
}

pub(crate) fn normalize_studio_version(raw: &str) -> String {
    raw.trim()
        .trim_start_matches("studio-")
        .trim_start_matches('v')
        .trim_start_matches('V')
        .to_string()
}

fn parse_semver(raw: &str) -> Option<(u64, u64, u64)> {
    let n = normalize_studio_version(raw);
    let mut parts = n.split('.');
    let major = parts.next()?.parse().ok()?;
    let minor = parts.next()?.parse().ok()?;
    let patch = parts.next()?.parse().ok()?;
    Some((major, minor, patch))
}

pub(crate) fn is_newer_studio_version(current: &str, candidate: &str) -> bool {
    match (parse_semver(current), parse_semver(candidate)) {
        (Some(cur), Some(next)) => next > cur,
        _ => false,
    }
}

async fn peek_latest_version() -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(CHECK_TIMEOUT)
        .redirect(reqwest::redirect::Policy::limited(10))
        .build()
        .map_err(|err| err.to_string())?;
    let response = client
        .get(LATEST_JSON_URL)
        .header("Accept", "application/json, application/octet-stream, */*")
        .send()
        .await
        .map_err(|err| format!("Studio update feed failed: {err}"))?;
    if !response.status().is_success() {
        return Err(format!(
            "Studio update feed HTTP {}",
            response.status().as_u16()
        ));
    }
    let bytes = response.bytes().await.map_err(|err| err.to_string())?;
    let json: serde_json::Value =
        serde_json::from_slice(&bytes).map_err(|err| format!("Studio update feed was not JSON: {err}"))?;
    json.get("version")
        .and_then(|value| value.as_str())
        .map(normalize_studio_version)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "Studio update feed missing version".to_string())
}

async fn plugin_check_timed(
    updater: tauri_plugin_updater::Updater,
) -> Result<Option<tauri_plugin_updater::Update>, String> {
    match tokio::time::timeout(CHECK_TIMEOUT, updater.check()).await {
        Ok(Ok(update)) => Ok(update),
        Ok(Err(err)) => Err(err.to_string()),
        Err(_) => Err("Studio update check timed out after 15s".to_string()),
    }
}

#[tauri::command]
pub async fn check_studio_update(app: AppHandle) -> StudioUpdateCheckResult {
    let current_version = app.package_info().version.to_string();
    match peek_latest_version().await {
        Ok(latest) => {
            if !is_newer_studio_version(&current_version, &latest) {
                return StudioUpdateCheckResult::current(current_version);
            }
        }
        Err(err) => {
            return StudioUpdateCheckResult::error(current_version, err);
        }
    }

    let updater = match app.updater() {
        Ok(updater) => updater,
        Err(error) => return StudioUpdateCheckResult::error(current_version, error),
    };

    match plugin_check_timed(updater).await {
        Ok(Some(update)) => StudioUpdateCheckResult {
            ok: true,
            available: true,
            version: Some(update.version),
            current_version,
            notes: update.body,
            error: None,
        },
        Ok(None) => StudioUpdateCheckResult::current(current_version),
        Err(error) => StudioUpdateCheckResult::error(current_version, error),
    }
}

#[tauri::command]
pub async fn install_studio_update(app: AppHandle) -> StudioUpdateCheckResult {
    let current_version = app.package_info().version.to_string();
    match peek_latest_version().await {
        Ok(latest) => {
            if !is_newer_studio_version(&current_version, &latest) {
                return StudioUpdateCheckResult::current(current_version);
            }
        }
        Err(err) => {
            return StudioUpdateCheckResult::error(current_version, err);
        }
    }

    let updater = match app.updater() {
        Ok(updater) => updater,
        Err(error) => return StudioUpdateCheckResult::error(current_version, error),
    };
    let update = match plugin_check_timed(updater).await {
        Ok(Some(update)) => update,
        Ok(None) => return StudioUpdateCheckResult::current(current_version),
        Err(error) => return StudioUpdateCheckResult::error(current_version, error),
    };

    let _ = app.emit(
        STUDIO_UPDATE_PROGRESS_EVENT,
        DownloadProgressPayload {
            phase: "studio-download".to_string(),
            item: "studio".to_string(),
            message: "Downloading Studio update…".to_string(),
            pct: Some(86),
        },
    );

    let version = update.version.clone();
    let notes = update.body.clone();
    let app_progress = app.clone();
    let downloaded = Arc::new(AtomicU64::new(0));
    let downloaded_cb = Arc::clone(&downloaded);
    let download = update.download_and_install(
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
    );

    match tokio::time::timeout(DOWNLOAD_TIMEOUT, download).await {
        Ok(Ok(())) => {}
        Ok(Err(error)) => return StudioUpdateCheckResult::error(current_version, error),
        Err(_) => {
            return StudioUpdateCheckResult::error(
                current_version,
                "Studio update download timed out",
            )
        }
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

#[cfg(test)]
mod tests {
    use super::{is_newer_studio_version, normalize_studio_version};

    #[test]
    fn same_version_is_not_an_update() {
        assert!(!is_newer_studio_version("0.50.36", "0.50.36"));
        assert!(!is_newer_studio_version("v0.50.36", "studio-v0.50.36"));
        assert!(is_newer_studio_version("0.50.36", "0.50.37"));
        assert!(!is_newer_studio_version("0.50.36", "0.50.35"));
        assert_eq!(normalize_studio_version("studio-v0.50.36"), "0.50.36");
    }
}
