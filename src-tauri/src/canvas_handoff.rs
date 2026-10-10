//! Canvas is an internal sidecar plugin; never run a standalone installer or GUI.
use std::fs;
use std::path::PathBuf;
use chrono::Utc;
use serde::Serialize;
use serde_json::json;
use crate::app_layout;

const MAX_CANVAS_IMAGE_BYTES: usize = 64 * 1024 * 1024;
const MAX_CANVAS_AUDIO_BYTES: usize = 512 * 1024 * 1024;
#[derive(Serialize)]
pub struct CanvasHandoffResult {
    pub ok: bool, pub launched: bool, pub album_art_path: Option<String>,
    pub handoff_path: Option<String>, pub error: Option<String>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CanvasAddonStatus {
    pub id: String, pub title: String, pub description: String,
    pub installed: bool, pub path: Option<String>, pub uninstaller_path: Option<String>,
    pub repo_url: Option<String>, pub install_url: Option<String>, pub releases_url: Option<String>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CanvasAddonActionResult {
    pub ok: bool, pub launched: bool, pub already_installed: bool, pub mode: Option<String>,
    pub path: Option<String>, pub uninstaller_path: Option<String>, pub url: Option<String>, pub error: Option<String>,
}
fn suite_dir() -> Result<PathBuf, String> { app_layout::data_dir(None) }
struct Config { exports_subdir: &'static str, handoff_file: &'static str }
fn config() -> Config { Config { exports_subdir: "exports", handoff_file: "handoff.json" } }
fn manifest() -> Result<PathBuf, String> { Ok(app_layout::canvas_addon_dir(None)?.join("plugin.json")) }
fn installed() -> bool {
    manifest().ok().and_then(|p| fs::read_to_string(p).ok()).and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok()).is_some_and(|v| v["owner"] == app_layout::STUDIO_IDENTIFIER && v["kind"] == "sidecar" && v["id"] == "canvas")
}
fn action(result: Result<(), String>, mode: &str) -> CanvasAddonActionResult {
    CanvasAddonActionResult { ok: result.is_ok(), launched: false, already_installed: installed(), mode: Some(mode.into()), path: manifest().ok().map(|p| p.to_string_lossy().into_owned()), uninstaller_path: None, url: None, error: result.err() }
}
#[tauri::command]
pub fn suite_canvas_addon_status() -> CanvasAddonStatus {
    CanvasAddonStatus { id: "canvas".into(), title: "Canvas sidecar plugin".into(), description: "Create short Canvas loops inside Studio.".into(), installed: installed(), path: manifest().ok().map(|p| p.to_string_lossy().into_owned()), uninstaller_path: None, repo_url: None, install_url: None, releases_url: None }
}
#[tauri::command]
pub async fn install_canvas_addon(app: tauri::AppHandle) -> CanvasAddonActionResult {
    match tauri::async_runtime::spawn_blocking(move || {
        let result = crate::internal_plugins::run_plugin_module(&app, "ai_sidecar.canvas_plugin", &["--install"]).map(|_| ());
        action(result, "installed")
    }).await { Ok(r) => r, Err(e) => action(Err(e.to_string()), "install-failed") }
}
pub fn refresh_canvas_addon_blocking() -> CanvasAddonActionResult {
    action(Ok(()), if installed() { "updated" } else { "skipped" })
}
#[tauri::command]
pub fn uninstall_canvas_addon() -> CanvasAddonActionResult {
    let result = manifest().and_then(|p| if p.exists() { fs::remove_file(p).map_err(|e| e.to_string()) } else { Ok(()) });
    action(result, "uninstalled")
}
fn open_canvas_panel(app: &tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    if !installed() { return Err("Activate the internal Canvas plugin in Plugins".into()); }
    if let Some(window) = app.get_webview_window("canvas") { window.set_focus().map_err(|e| e.to_string())?; }
    else { tauri::WebviewWindowBuilder::new(app, "canvas", tauri::WebviewUrl::App("canvas.html".into())).title("Studio — Canvas plugin").inner_size(700.0, 850.0).build().map_err(|e| e.to_string())?; }
    Ok(())
}
#[tauri::command]
pub fn launch_canvas_addon(app: tauri::AppHandle) -> CanvasAddonActionResult {
    let mut result = action(open_canvas_panel(&app), "internal-panel"); result.launched = result.ok; result
}
#[tauri::command]
pub async fn canvas_preview_bytes() -> Result<Vec<u8>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        if !installed() { return Err("Canvas plugin is not active".into()); }
        let path = app_layout::canvas_addon_dir(None)?.join("preview.mp4");
        if fs::metadata(&path).map_err(|e| e.to_string())?.len() > 64 * 1024 * 1024 { return Err("Canvas preview is too large".into()); }
        fs::read(path).map_err(|e| e.to_string())
    }).await.map_err(|e| e.to_string())?
}

fn sanitize_ext(ext: &str) -> String {
    match ext
        .trim()
        .trim_start_matches('.')
        .to_ascii_lowercase()
        .as_str()
    {
        "jpg" | "jpeg" => "jpg".to_string(),
        "webp" => "webp".to_string(),
        "gif" => "gif".to_string(),
        _ => "png".to_string(),
    }
}

fn sanitize_audio_ext(ext: &str) -> String {
    match ext
        .trim()
        .trim_start_matches('.')
        .to_ascii_lowercase()
        .as_str()
    {
        "wav" => "wav".to_string(),
        "m4a" | "aac" | "alac" => "m4a".to_string(),
        "caf" => "caf".to_string(),
        "flac" => "flac".to_string(),
        "ogg" => "ogg".to_string(),
        _ => "mp3".to_string(),
    }
}

fn handoff_timestamp_iso() -> String {
    Utc::now().to_rfc3339()
}

#[tauri::command]
pub async fn export_canvas_handoff(
    app: tauri::AppHandle,
    title: String,
    artist: String,
    image_bytes: Vec<u8>,
    ext: Option<String>,
    audio_bytes: Option<Vec<u8>>,
    audio_ext: Option<String>,
    motion_hint: Option<String>,
    duration_sec: Option<u32>,
) -> CanvasHandoffResult {
    if image_bytes.len() > MAX_CANVAS_IMAGE_BYTES {
        return CanvasHandoffResult {
            ok: false,
            launched: false,
            album_art_path: None,
            handoff_path: None,
            error: Some("image payload exceeds the 64 MiB limit".to_string()),
        };
    }
    if audio_bytes
        .as_ref()
        .map(|b| b.len())
        .unwrap_or(0)
        > MAX_CANVAS_AUDIO_BYTES
    {
        return CanvasHandoffResult {
            ok: false,
            launched: false,
            album_art_path: None,
            handoff_path: None,
            error: Some("audio payload exceeds the 512 MiB limit".to_string()),
        };
    }
    tauri::async_runtime::spawn_blocking(move || {
        export_canvas_handoff_sync(
            app,
            title,
            artist,
            image_bytes,
            ext,
            audio_bytes,
            audio_ext,
            motion_hint,
            duration_sec,
        )
    })
    .await
    .unwrap_or_else(|err| CanvasHandoffResult {
        ok: false,
        launched: false,
        album_art_path: None,
        handoff_path: None,
        error: Some(format!("canvas handoff task failed: {err}")),
    })
}

fn export_canvas_handoff_sync(
    app: tauri::AppHandle,
    title: String,
    artist: String,
    image_bytes: Vec<u8>,
    ext: Option<String>,
    audio_bytes: Option<Vec<u8>>,
    audio_ext: Option<String>,
    motion_hint: Option<String>,
    duration_sec: Option<u32>,
) -> CanvasHandoffResult {
    if image_bytes.is_empty() {
        return CanvasHandoffResult {
            ok: false,
            launched: false,
            album_art_path: None,
            handoff_path: None,
            error: Some("empty image payload".to_string()),
        };
    }

    let suite = match suite_dir() {
        Ok(dir) => dir,
        Err(err) => {
            return CanvasHandoffResult {
                ok: false,
                launched: false,
                album_art_path: None,
                handoff_path: None,
                error: Some(format!("Studio data directory unavailable: {err}")),
            };
        }
    };
    let exports = suite.join(&config().exports_subdir);
    if fs::create_dir_all(&exports).is_err() {
        return CanvasHandoffResult {
            ok: false,
            launched: false,
            album_art_path: None,
            handoff_path: None,
            error: Some("could not create exports directory".to_string()),
        };
    }

    let ext_clean = sanitize_ext(ext.as_deref().unwrap_or("png"));
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let art_name = format!("album-art-{stamp}.{ext_clean}");
    let art_path = exports.join(&art_name);
    if fs::write(&art_path, &image_bytes).is_err() {
        return CanvasHandoffResult {
            ok: false,
            launched: false,
            album_art_path: None,
            handoff_path: None,
            error: Some("could not write artwork export".to_string()),
        };
    }

    let handoff_path = suite.join(&config().handoff_file);
    let mut track = json!({
        "title": title,
        "artist": artist,
        "albumArtPath": art_path.to_string_lossy(),
    });
    if let Some(bytes) = audio_bytes.filter(|b| !b.is_empty()) {
        let audio_clean = sanitize_audio_ext(audio_ext.as_deref().unwrap_or("mp3"));
        let audio_name = format!("track-audio-{stamp}.{audio_clean}");
        let audio_path = exports.join(&audio_name);
        if fs::write(&audio_path, &bytes).is_ok() {
            track["audioPath"] = json!(audio_path.to_string_lossy());
        }
    }
    let handoff = json!({
        "version": 1,
        "timestamp": handoff_timestamp_iso(),
        "source": "ai-music-tool",
        "track": track,
        "canvas": {
            "motionHint": motion_hint.unwrap_or_else(|| "cinematic drift, soft glow, 8 seconds".to_string()),
            "durationSec": duration_sec.unwrap_or(8),
        },
    });
    if fs::write(
        &handoff_path,
        serde_json::to_string_pretty(&handoff).unwrap_or_else(|_| handoff.to_string()),
    )
    .is_err()
    {
        return CanvasHandoffResult {
            ok: false,
            launched: false,
            album_art_path: Some(art_path.to_string_lossy().into_owned()),
            handoff_path: None,
            error: Some("could not write handoff.json".to_string()),
        };
    }

    let render = crate::internal_plugins::run_plugin_module(&app, "ai_sidecar.canvas_plugin", &[handoff_path.to_str().unwrap_or("")]);
    if let Err(error) = render {
        return CanvasHandoffResult { ok: false, launched: false, album_art_path: Some(art_path.to_string_lossy().into_owned()), handoff_path: Some(handoff_path.to_string_lossy().into_owned()), error: Some(error) };
    }
    let launched = open_canvas_panel(&app).is_ok();
    use tauri::Emitter;
    let _ = app.emit("canvas-preview-ready", ());

    CanvasHandoffResult {
        ok: true,
        launched,
        album_art_path: Some(art_path.to_string_lossy().into_owned()),
        handoff_path: Some(handoff_path.to_string_lossy().into_owned()),
        error: None,
    }
}
