//! Signed Tauri Studio updates from the latest GitHub release.

use serde::Serialize;
use std::time::Duration;
use tauri::AppHandle;
use tauri_plugin_updater::UpdaterExt;

const LATEST_JSON_URL: &str =
    "https://github.com/Druttzen/ai-music-tool/releases/latest/download/latest.json";
const CHECK_TIMEOUT: Duration = Duration::from_secs(15);

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
    StudioUpdateCheckResult::error(
        app.package_info().version.to_string(),
        "Uninstall Studio first, then install the new version. Your projects and exports are preserved. Internal plugins can be updated inside Studio.",
    )
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
