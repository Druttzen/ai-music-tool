//! Refresh installed addons, plugins, tools, and usable archives, then Studio itself.

use std::fs;
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;

use serde::Serialize;
use serde_json::Value;
use tauri::{AppHandle, Emitter};

use crate::app_layout;
use crate::canvas_handoff::refresh_canvas_addon_blocking;
use crate::sidecar_extra_install::{known_extra_ids, upgrade_one_sidecar_extra};
use crate::sidecar_manager::SidecarManager;
use crate::sidecar_userdata::{ensure_user_sidecar_pkg, load_installed_extras};
use crate::studio_updater::{install_studio_update, StudioUpdateCheckResult};

pub const STUDIO_COMPONENT_UPDATE_PROGRESS_EVENT: &str = "studio-component-update-progress";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ComponentUpdateItem {
    pub kind: String,
    pub id: String,
    pub ok: bool,
    pub skipped: bool,
    pub message: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioAllUpdateResult {
    pub ok: bool,
    pub available: bool,
    pub version: Option<String>,
    pub current_version: String,
    pub notes: Option<String>,
    pub error: Option<String>,
    pub summary: String,
    pub components: Vec<ComponentUpdateItem>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProgressPayload {
    phase: String,
    item: String,
    message: String,
}

fn emit_progress(app: &AppHandle, phase: &str, item: &str, message: &str) {
    let _ = app.emit(
        STUDIO_COMPONENT_UPDATE_PROGRESS_EVENT,
        ProgressPayload {
            phase: phase.to_string(),
            item: item.to_string(),
            message: message.to_string(),
        },
    );
}

pub(crate) fn normalize_extra_id(raw: &str) -> Option<String> {
    crate::sidecar_userdata::pip_extra_spec(raw).map(str::to_string)
}

pub(crate) fn extras_from_sidecar_health(health: &Value) -> Vec<String> {
    let mut ids = Vec::new();
    let flags = [
        ("stems_available", "stems"),
        ("stemsAvailable", "stems"),
        ("stems_melband_available", "stems-melband"),
        ("stemsMelbandAvailable", "stems-melband"),
        ("generate_available", "generate"),
        ("generateAvailable", "generate"),
        ("genre_available", "classify"),
        ("genreAvailable", "classify"),
        ("vision_available", "vision"),
        ("visionAvailable", "vision"),
        ("cover_available", "cover"),
        ("coverAvailable", "cover"),
        ("cover_ref_available", "cover-ref"),
        ("coverRefAvailable", "cover-ref"),
        ("vocal_ml_available", "vocal"),
        ("vocalMlAvailable", "vocal"),
        ("vocal_rvc_available", "vocal-rvc"),
        ("vocalRvcAvailable", "vocal-rvc"),
    ];
    for (key, extra) in flags {
        if health.get(key).and_then(Value::as_bool) == Some(true) {
            ids.push(extra.to_string());
        }
    }
    if let Some(caps) = health.get("capabilities").and_then(Value::as_array) {
        for cap in caps {
            let available = cap.get("available").and_then(Value::as_bool) == Some(true);
            if !available {
                continue;
            }
            if let Some(id) = cap.get("id").and_then(Value::as_str) {
                if let Some(mapped) = normalize_extra_id(id) {
                    ids.push(mapped);
                }
            }
        }
    }
    ids.sort();
    ids.dedup();
    ids
}

fn looks_like_installer_archive(path: &Path) -> bool {
    let name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    name.contains("setup") || name.contains("installer") || name.contains("nsis")
}

fn archive_dest(zip_path: &Path) -> PathBuf {
    let stem = zip_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("archive");
    zip_path
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| PathBuf::from("."))
        .join(stem)
}

fn zip_is_newer_than_dest(zip_path: &Path, dest: &Path) -> bool {
    if !dest.exists() {
        return true;
    }
    let zip_mtime = fs::metadata(zip_path).and_then(|m| m.modified()).ok();
    let dest_mtime = fs::metadata(dest).and_then(|m| m.modified()).ok();
    match (zip_mtime, dest_mtime) {
        (Some(zip), Some(dest_time)) => zip > dest_time,
        _ => true,
    }
}

pub(crate) fn extract_zip_archive(zip_path: &Path, dest: &Path) -> Result<(), String> {
    let file = fs::File::open(zip_path).map_err(|err| format!("open zip: {err}"))?;
    let mut archive = zip::ZipArchive::new(file).map_err(|err| format!("read zip: {err}"))?;
    fs::create_dir_all(dest).map_err(|err| format!("create dest: {err}"))?;
    for index in 0..archive.len() {
        let mut entry = archive
            .by_index(index)
            .map_err(|err| format!("zip entry: {err}"))?;
        let Some(enclosed) = entry.enclosed_name() else {
            continue;
        };
        let out = dest.join(enclosed);
        if entry.is_dir() {
            fs::create_dir_all(&out).map_err(|err| format!("zip dir: {err}"))?;
            continue;
        }
        if let Some(parent) = out.parent() {
            fs::create_dir_all(parent).map_err(|err| format!("zip parent: {err}"))?;
        }
        let mut outfile = fs::File::create(&out).map_err(|err| format!("zip write: {err}"))?;
        io::copy(&mut entry, &mut outfile).map_err(|err| format!("zip copy: {err}"))?;
        outfile.flush().map_err(|err| format!("zip flush: {err}"))?;
    }
    Ok(())
}

fn collect_zip_files(dir: &Path) -> Vec<PathBuf> {
    collect_zip_files_at_depth(dir, 0)
}

fn collect_zip_files_at_depth(dir: &Path, depth: usize) -> Vec<PathBuf> {
    let Ok(entries) = fs::read_dir(dir) else {
        return Vec::new();
    };
    let mut zips = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            if depth < 2 {
                zips.extend(collect_zip_files_at_depth(&path, depth + 1));
            }
            continue;
        }
        let is_zip = path
            .extension()
            .and_then(|ext| ext.to_str())
            .is_some_and(|ext| ext.eq_ignore_ascii_case("zip"));
        if is_zip && !looks_like_installer_archive(&path) {
            zips.push(path);
        }
    }
    zips.sort();
    zips
}

fn refresh_archives(app: Option<&AppHandle>) -> Vec<ComponentUpdateItem> {
    let mut items = Vec::new();
    let mut dirs = Vec::new();
    if let Ok(dir) = app_layout::addons_dir(app) {
        dirs.push(dir);
    }
    if let Ok(dir) = app_layout::tools_dir(app) {
        dirs.push(dir);
    }
    if let Ok(dir) = app_layout::archives_dir(app) {
        let _ = fs::create_dir_all(&dir);
        dirs.push(dir);
    }
    for dir in dirs {
        for zip_path in collect_zip_files(&dir) {
            let dest = archive_dest(&zip_path);
            let id = zip_path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("archive")
                .to_string();
            if !zip_is_newer_than_dest(&zip_path, &dest) {
                items.push(ComponentUpdateItem {
                    kind: "archive".to_string(),
                    id,
                    ok: true,
                    skipped: true,
                    message: "Archive already extracted".to_string(),
                });
                continue;
            }
            match extract_zip_archive(&zip_path, &dest) {
                Ok(()) => items.push(ComponentUpdateItem {
                    kind: "archive".to_string(),
                    id,
                    ok: true,
                    skipped: false,
                    message: format!("Extracted to {}", dest.display()),
                }),
                Err(err) => items.push(ComponentUpdateItem {
                    kind: "archive".to_string(),
                    id,
                    ok: false,
                    skipped: false,
                    message: err,
                }),
            }
        }
    }
    items
}

fn extras_to_upgrade(app: &AppHandle, manager: &SidecarManager) -> Vec<String> {
    let mut ids = load_installed_extras(app);
    if let Some(health) = manager.fetch_health_json() {
        ids.extend(extras_from_sidecar_health(&health));
    }
    let mut ids: Vec<String> = ids
        .into_iter()
        .filter_map(|id| normalize_extra_id(&id))
        .filter(|id| known_extra_ids().contains(&id.as_str()))
        .collect();
    ids.sort();
    ids.dedup();
    ids
}

fn update_components_blocking(
    app: AppHandle,
    manager: Arc<SidecarManager>,
) -> Vec<ComponentUpdateItem> {
    let mut components = Vec::new();

    emit_progress(&app, "sidecar", "sidecar", "Refreshing sidecar package…");
    match ensure_user_sidecar_pkg(&app) {
        Ok(pkg) => components.push(ComponentUpdateItem {
            kind: "sidecar".to_string(),
            id: "sidecar-pkg".to_string(),
            ok: true,
            skipped: false,
            message: format!("Sidecar package ready at {}", pkg.display()),
        }),
        Err(err) => components.push(ComponentUpdateItem {
            kind: "sidecar".to_string(),
            id: "sidecar-pkg".to_string(),
            ok: true,
            skipped: true,
            message: format!("Sidecar package unchanged ({err})"),
        }),
    }

    emit_progress(&app, "canvas", "canvas", "Refreshing Canvas addon…");
    let canvas = refresh_canvas_addon_blocking();
    components.push(ComponentUpdateItem {
        kind: "canvas".to_string(),
        id: "canvas".to_string(),
        ok: canvas.ok,
        skipped: canvas.mode.as_deref() == Some("skipped"),
        message: canvas
            .error
            .clone()
            .or(canvas.mode.clone())
            .unwrap_or_else(|| "Canvas checked".to_string()),
    });

    emit_progress(&app, "archives", "archives", "Refreshing usable archives…");
    let archives = refresh_archives(Some(&app));
    if archives.is_empty() {
        components.push(ComponentUpdateItem {
            kind: "archive".to_string(),
            id: "archives".to_string(),
            ok: true,
            skipped: true,
            message: "No usable archives to refresh".to_string(),
        });
    } else {
        components.extend(archives);
    }

    let extras = extras_to_upgrade(&app, &manager);
    if extras.is_empty() {
        components.push(ComponentUpdateItem {
            kind: "extra".to_string(),
            id: "plugins".to_string(),
            ok: true,
            skipped: true,
            message: "No installed plugins to refresh".to_string(),
        });
        return components;
    }

    emit_progress(
        &app,
        "plugins",
        "plugins",
        "Updating installed sidecar plugins…",
    );
    manager.stop();
    for extra_id in extras {
        emit_progress(
            &app,
            "plugin",
            &extra_id,
            &format!("Updating {extra_id}…"),
        );
        let result = upgrade_one_sidecar_extra(&app, &extra_id);
        components.push(ComponentUpdateItem {
            kind: "extra".to_string(),
            id: extra_id,
            ok: result.ok,
            skipped: false,
            message: result
                .message
                .or(result.error)
                .unwrap_or_else(|| "Plugin update finished".to_string()),
        });
    }
    manager.restart();
    let _ = manager.wait_until_ready(Duration::from_secs(45));
    components
}

fn summarize(components: &[ComponentUpdateItem], studio: &StudioUpdateCheckResult) -> String {
    let refreshed = components
        .iter()
        .filter(|item| item.ok && !item.skipped)
        .count();
    let failed = components.iter().filter(|item| !item.ok).count();
    let mut parts = Vec::new();
    if refreshed > 0 {
        parts.push(format!(
            "Refreshed {refreshed} addon(s)/plugin(s)/archive(s)"
        ));
    } else {
        parts.push("Addons, plugins, tools, and archives are current".to_string());
    }
    if failed > 0 {
        parts.push(format!("{failed} component(s) need attention"));
    }
    if studio.available {
        if let Some(version) = &studio.version {
            parts.push(format!("Studio update {version} installed"));
        } else {
            parts.push("Studio update installed".to_string());
        }
    } else {
        parts.push("Studio app is current".to_string());
    }
    parts.join(". ")
}

#[tauri::command]
pub async fn update_studio_all(
    app: AppHandle,
    manager: tauri::State<'_, Arc<SidecarManager>>,
) -> Result<StudioAllUpdateResult, String> {
    let mgr = Arc::clone(manager.inner());
    let app_for_components = app.clone();
    let components = tauri::async_runtime::spawn_blocking(move || {
        update_components_blocking(app_for_components, mgr)
    })
    .await
    .map_err(|err| format!("Component update task failed: {err}"))?;

    emit_progress(&app, "studio", "studio", "Checking Studio app update…");
    let studio = install_studio_update(app.clone()).await;
    let failed = components.iter().any(|item| !item.ok);
    let summary = summarize(&components, &studio);
    Ok(StudioAllUpdateResult {
        ok: studio.ok && !failed,
        available: studio.available,
        version: studio.version,
        current_version: studio.current_version,
        notes: studio.notes,
        error: studio.error,
        summary,
        components,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::io::Write;

    #[test]
    fn extras_from_sidecar_health_maps_flags_and_capabilities() {
        let health = json!({
            "stems_available": true,
            "generate_available": false,
            "genre_available": true,
            "cover_ref_available": true,
            "capabilities": [
                { "id": "cover", "available": true },
                { "id": "rvc", "available": true },
                { "id": "vocal_ml", "available": true },
                { "id": "vocal-ml", "available": true },
                { "id": "vision", "available": false }
            ]
        });
        let ids = extras_from_sidecar_health(&health);
        assert!(ids.contains(&"stems".to_string()));
        assert!(ids.contains(&"classify".to_string()));
        assert!(ids.contains(&"cover-ref".to_string()));
        assert!(ids.contains(&"cover".to_string()));
        assert!(ids.contains(&"vocal-rvc".to_string()));
        assert!(ids.contains(&"vocal".to_string()));
        assert!(ids.contains(&"vocal-ml".to_string()));
        assert!(!ids.contains(&"generate".to_string()));
        assert!(!ids.contains(&"vision".to_string()));
    }

    #[test]
    fn normalize_extra_id_maps_catalog_aliases() {
        assert_eq!(normalize_extra_id("genre").as_deref(), Some("classify"));
        assert_eq!(normalize_extra_id("rvc").as_deref(), Some("vocal-rvc"));
        assert_eq!(normalize_extra_id("vocal_ml").as_deref(), Some("vocal"));
        assert_eq!(normalize_extra_id("vocal-ml").as_deref(), Some("vocal-ml"));
        assert_eq!(normalize_extra_id("cover_ref").as_deref(), Some("cover-ref"));
        assert_eq!(normalize_extra_id("nope"), None);
    }

    #[test]
    fn extract_zip_archive_writes_enclosed_files() {
        let stamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("aimc-zip-{stamp}"));
        fs::create_dir_all(&dir).unwrap();
        let zip_path = dir.join("pack.zip");
        let dest = dir.join("pack");
        {
            let file = fs::File::create(&zip_path).unwrap();
            let mut zip = zip::ZipWriter::new(file);
            let options = zip::write::SimpleFileOptions::default()
                .compression_method(zip::CompressionMethod::Stored);
            zip.start_file("hello.txt", options).unwrap();
            zip.write_all(b"studio").unwrap();
            zip.finish().unwrap();
        }
        extract_zip_archive(&zip_path, &dest).expect("extract");
        assert_eq!(fs::read_to_string(dest.join("hello.txt")).unwrap(), "studio");
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn installer_like_zip_names_are_skipped() {
        assert!(looks_like_installer_archive(Path::new("CanvasSetup.zip")));
        assert!(!looks_like_installer_archive(Path::new("drum-kit.zip")));
    }
}
