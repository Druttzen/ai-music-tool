//! AI Music Tool → AI Canvas Tool suite handoff (Tauri native).

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::OnceLock;

use chrono::Utc;
use serde::Deserialize;
use serde::Serialize;
use serde_json::json;

const CONFIG_JSON: &str = include_str!("../../lib/suite-handoff-paths.json");

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SuiteHandoffConfig {
    suite_path_from_home: Vec<String>,
    exports_subdir: String,
    handoff_file: String,
    canvas_candidates: CanvasCandidates,
}

#[derive(Debug, Deserialize)]
struct CanvasCandidates {
    windows: Vec<String>,
    #[allow(dead_code)]
    macos: Vec<String>,
    #[allow(dead_code)]
    linux: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct CanvasHandoffResult {
    pub ok: bool,
    pub launched: bool,
    pub album_art_path: Option<String>,
    pub handoff_path: Option<String>,
    pub error: Option<String>,
}

fn config() -> &'static SuiteHandoffConfig {
    static CONFIG: OnceLock<SuiteHandoffConfig> = OnceLock::new();
    CONFIG.get_or_init(|| {
        serde_json::from_str(CONFIG_JSON).expect("parse lib/suite-handoff-paths.json")
    })
}

fn user_home() -> PathBuf {
    std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("."))
}

fn suite_dir() -> PathBuf {
    let mut dir = user_home();
    for segment in &config().suite_path_from_home {
        dir.push(segment);
    }
    dir
}

fn expand_path_template(template: &str) -> PathBuf {
    let mut s = template.to_string();
    if let Ok(v) = std::env::var("HOME") {
        s = s.replace("$HOME", &v);
    }
    if let Ok(v) = std::env::var("USERPROFILE") {
        s = s.replace("$USERPROFILE", &v);
    }
    if let Ok(v) = std::env::var("LOCALAPPDATA") {
        s = s.replace("$LOCALAPPDATA", &v);
    }
    if let Ok(v) = std::env::var("ProgramFiles") {
        s = s.replace("$ProgramFiles", &v);
    }
    PathBuf::from(s)
}

fn canvas_platform_candidates() -> &'static [String] {
    #[cfg(target_os = "windows")]
    {
        return &config().canvas_candidates.windows;
    }
    #[cfg(target_os = "macos")]
    {
        return &config().canvas_candidates.macos;
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        return &config().canvas_candidates.linux;
    }
}

fn resolve_canvas_executable() -> Option<PathBuf> {
    canvas_platform_candidates()
        .iter()
        .map(|t| expand_path_template(t))
        .find(|p| p.is_file())
}

fn launch_canvas_tool(handoff_file: &Path) -> bool {
    if let Some(exe) = resolve_canvas_executable() {
        return Command::new(exe)
            .arg("--handoff")
            .arg(handoff_file)
            .spawn()
            .map(|mut child| {
                let _ = child.stdin.take();
                true
            })
            .unwrap_or(false);
    }
    false
}

fn sanitize_ext(ext: &str) -> String {
    match ext.trim().trim_start_matches('.').to_ascii_lowercase().as_str() {
        "jpg" | "jpeg" => "jpg".to_string(),
        "webp" => "webp".to_string(),
        "gif" => "gif".to_string(),
        _ => "png".to_string(),
    }
}

fn handoff_timestamp_iso() -> String {
    Utc::now().to_rfc3339()
}

#[tauri::command]
pub fn export_canvas_handoff(
    title: String,
    artist: String,
    image_bytes: Vec<u8>,
    ext: Option<String>,
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

    let suite = suite_dir();
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
    let handoff = json!({
        "version": 1,
        "timestamp": handoff_timestamp_iso(),
        "source": "ai-music-tool",
        "track": {
            "title": title,
            "artist": artist,
            "albumArtPath": art_path.to_string_lossy(),
        },
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

    let mut launched = launch_canvas_tool(&handoff_path);
    if !launched {
        launched = open::that(&exports).is_ok() || open::that(&handoff_path).is_ok();
    }

    CanvasHandoffResult {
        ok: true,
        launched,
        album_art_path: Some(art_path.to_string_lossy().into_owned()),
        handoff_path: Some(handoff_path.to_string_lossy().into_owned()),
        error: None,
    }
}
