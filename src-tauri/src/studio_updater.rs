//! Signed Tauri Studio updates from the latest GitHub release.

use crate::sidecar_manager::SidecarManager;
use crate::studio_component_update::emit_progress_pct;
use serde::Serialize;
use std::{
    sync::atomic::{AtomicBool, Ordering},
    sync::Arc,
    time::Duration,
};
use tauri::{AppHandle, Manager};
use tauri_plugin_updater::UpdaterExt;

const LATEST_JSON_URL: &str =
    "https://github.com/Druttzen/ai-music-tool/releases/latest/download/latest.json";
const CHECK_TIMEOUT: Duration = Duration::from_secs(15);
static UPDATE_IN_PROGRESS: AtomicBool = AtomicBool::new(false);
static UPDATE_RESTARTING: AtomicBool = AtomicBool::new(false);

/// Shared by automatic app updates and the full component update operation.
pub(crate) struct UpdateGuard;
impl UpdateGuard {
    pub(crate) fn acquire() -> Result<Self, String> {
        UPDATE_IN_PROGRESS
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .map(|_| Self)
            .map_err(|_| "A Studio update is already in progress".to_string())
    }
}
impl Drop for UpdateGuard {
    fn drop(&mut self) {
        UPDATE_IN_PROGRESS.store(false, Ordering::SeqCst);
    }
}
pub(crate) fn is_update_restart() -> bool {
    UPDATE_RESTARTING.load(Ordering::SeqCst)
}

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

    fn current(current_version: String, published_version: String) -> Self {
        Self {
            ok: true,
            available: false,
            version: Some(published_version),
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
    if parts.next().is_some() {
        return None;
    }
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
    let json: serde_json::Value = serde_json::from_slice(&bytes)
        .map_err(|err| format!("Studio update feed was not JSON: {err}"))?;
    let version = json
        .get("version")
        .and_then(|value| value.as_str())
        .map(normalize_studio_version)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "Studio update feed missing version".to_string())?;
    if parse_semver(&version).is_none() {
        return Err(format!(
            "Studio update feed contains an invalid version: {version}"
        ));
    }
    Ok(version)
}

async fn plugin_check_timed(
    updater: tauri_plugin_updater::Updater,
    remaining: Duration,
) -> Result<Option<tauri_plugin_updater::Update>, String> {
    match tokio::time::timeout(remaining, updater.check()).await {
        Ok(Ok(update)) => Ok(update),
        Ok(Err(err)) => Err(err.to_string()),
        Err(_) => Err("Studio update check timed out after 15s".to_string()),
    }
}

#[tauri::command]
pub async fn check_studio_update(app: AppHandle) -> StudioUpdateCheckResult {
    let check_started = std::time::Instant::now();
    let current_version = app.package_info().version.to_string();
    match peek_latest_version().await {
        Ok(latest) => {
            if !is_newer_studio_version(&current_version, &latest) {
                return StudioUpdateCheckResult::current(current_version, latest);
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

    match plugin_check_timed(
        updater,
        CHECK_TIMEOUT.saturating_sub(check_started.elapsed()),
    )
    .await
    {
        Ok(Some(update)) => StudioUpdateCheckResult {
            ok: true,
            available: true,
            version: Some(update.version),
            current_version,
            notes: update.body,
            error: None,
        },
        Ok(None) => StudioUpdateCheckResult::error(
            current_version,
            "A newer Studio release is published, but no compatible signed installer was returned",
        ),
        Err(error) => StudioUpdateCheckResult::error(current_version, error),
    }
}

#[tauri::command]
pub async fn install_studio_update(app: AppHandle) -> StudioUpdateCheckResult {
    let _guard = match UpdateGuard::acquire() {
        Ok(guard) => guard,
        Err(error) => {
            return StudioUpdateCheckResult::error(app.package_info().version.to_string(), error)
        }
    };
    install_studio_update_inner(app).await
}

pub(crate) async fn install_studio_update_inner(app: AppHandle) -> StudioUpdateCheckResult {
    let check_started = std::time::Instant::now();
    let current_version = app.package_info().version.to_string();
    if let Err(error) = crate::installation_policy::enforce() {
        return StudioUpdateCheckResult::error(current_version, error);
    }
    // An older feed may omit a newly supported architecture. Return "current"
    // before Tauri attempts to select a platform from that older manifest.
    match peek_latest_version().await {
        Ok(latest) if !is_newer_studio_version(&current_version, &latest) => {
            return StudioUpdateCheckResult::current(current_version, latest);
        }
        Ok(_) => {}
        Err(error) => return StudioUpdateCheckResult::error(current_version, error),
    }
    // Check has a short deadline; downloading a large bundle must not inherit it.
    let exit_app = app.clone();
    let builder = app
        .updater_builder()
        .configure_client(|client| {
            client
                .connect_timeout(Duration::from_secs(15))
                .read_timeout(Duration::from_secs(60))
        })
        .on_before_exit(move || {
            UPDATE_RESTARTING.store(true, Ordering::SeqCst);
            if let Some(manager) = exit_app.try_state::<Arc<SidecarManager>>() {
                manager.stop();
            }
        });
    let updater = match builder.build() {
        Ok(updater) => updater,
        Err(error) => return StudioUpdateCheckResult::error(current_version, error),
    };
    let update = match plugin_check_timed(
        updater,
        CHECK_TIMEOUT.saturating_sub(check_started.elapsed()),
    )
    .await
    {
        Ok(Some(update)) if is_newer_studio_version(&current_version, &update.version) => update,
        Ok(_) => return StudioUpdateCheckResult::error(
            current_version,
            "A newer Studio release is published, but no compatible signed installer was returned",
        ),
        Err(error) => return StudioUpdateCheckResult::error(current_version, error),
    };
    emit_progress_pct(
        &app,
        "studio-download",
        "studio",
        "Downloading signed Studio update…",
        None,
    );
    let mut downloaded = 0u64;
    let mut last_pct = None;
    // Tauri verifies the downloaded bytes against the configured public key before
    // returning them. Never stop the sidecar or invoke the installer on bad signatures.
    let bytes = match update
        .download(
            |chunk, total| {
                downloaded = downloaded.saturating_add(chunk as u64);
                let pct = download_progress(downloaded, total);
                if pct != last_pct {
                    last_pct = pct;
                    emit_progress_pct(
                        &app,
                        "studio-download",
                        "studio",
                        "Downloading signed Studio update…",
                        pct,
                    );
                }
            },
            || {},
        )
        .await
    {
        Ok(bytes) => bytes,
        Err(error) => {
            emit_progress_pct(
                &app,
                "studio-error",
                "studio",
                &format!("Studio update failed: {error}"),
                None,
            );
            return StudioUpdateCheckResult::error(current_version, error);
        }
    };
    emit_progress_pct(
        &app,
        "studio-install",
        "studio",
        "Installing verified Studio update. Restarting…",
        None,
    );
    // Windows' updater starts NSIS with /UPDATE and /R and exits this process.
    // NSIS permits only a newer version in the registered directory.
    if let Err(error) = update.install(bytes) {
        UPDATE_RESTARTING.store(false, Ordering::SeqCst);
        emit_progress_pct(
            &app,
            "studio-error",
            "studio",
            &format!("Studio update failed: {error}"),
            None,
        );
        return StudioUpdateCheckResult::error(current_version, error);
    }
    // macOS/Linux install in place and need an explicit application restart.
    UPDATE_RESTARTING.store(true, Ordering::SeqCst);
    if let Some(manager) = app.try_state::<Arc<SidecarManager>>() {
        manager.stop();
    }
    app.restart();
}

fn download_progress(downloaded: u64, total: Option<u64>) -> Option<u32> {
    total
        .filter(|total| *total > 0)
        .map(|total| ((downloaded.min(total) as u128 * 100) / total as u128) as u32)
}

#[cfg(test)]
mod tests {
    use super::{
        download_progress, is_newer_studio_version, normalize_studio_version, UpdateGuard,
    };

    #[test]
    fn same_version_is_not_an_update() {
        assert!(!is_newer_studio_version("0.50.36", "0.50.36"));
        assert!(!is_newer_studio_version("v0.50.36", "studio-v0.50.36"));
        assert!(is_newer_studio_version("0.50.36", "0.50.37"));
        assert!(!is_newer_studio_version("0.50.36", "0.50.35"));
        assert_eq!(normalize_studio_version("studio-v0.50.36"), "0.50.36");
        assert!(!is_newer_studio_version("0.50.36", "0.50.37.1"));
        assert!(!is_newer_studio_version("0.50.36", "0.50.37-beta"));
    }

    #[test]
    fn progress_measures_download_bytes_and_leaves_unknown_totals_unknown() {
        assert_eq!(download_progress(0, Some(100)), Some(0));
        assert_eq!(download_progress(50, Some(100)), Some(50));
        assert_eq!(download_progress(u64::MAX, Some(100)), Some(100));
        assert_eq!(download_progress(200, Some(0)), None);
        assert_eq!(download_progress(200, None), None);
    }

    #[test]
    fn no_update_result_retains_both_installed_and_published_versions() {
        let result = super::StudioUpdateCheckResult::current("0.50.73".into(), "0.50.70".into());
        assert!(result.ok);
        assert!(!result.available);
        assert_eq!(result.current_version, "0.50.73");
        assert_eq!(result.version.as_deref(), Some("0.50.70"));
    }

    #[test]
    fn concurrent_updates_are_rejected_and_guard_is_released() {
        let guard = UpdateGuard::acquire().unwrap();
        assert!(UpdateGuard::acquire().is_err());
        drop(guard);
        assert!(UpdateGuard::acquire().is_ok());
    }
}
