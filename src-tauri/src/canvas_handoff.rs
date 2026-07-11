//! AI Music Tool → AI Canvas Tool suite handoff (Tauri native).

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use serde::Serialize;
use serde_json::json;

#[derive(Debug, Serialize)]
pub struct CanvasHandoffResult {
    pub ok: bool,
    pub launched: bool,
    pub album_art_path: Option<String>,
    pub handoff_path: Option<String>,
    pub error: Option<String>,
}

fn suite_dir() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        let home = std::env::var("USERPROFILE")
            .ok()
            .map(PathBuf::from)
            .or_else(dirs_documents_home)
            .unwrap_or_else(|| PathBuf::from("."));
        return home.join("Documents").join("AI Suite");
    }
    #[cfg(not(target_os = "windows"))]
    {
        dirs_documents_home()
            .map(|d| d.join("AI Suite"))
            .unwrap_or_else(|| PathBuf::from("AI Suite"))
    }
}

fn dirs_documents_home() -> Option<PathBuf> {
    std::env::var("HOME")
        .ok()
        .map(PathBuf::from)
        .or_else(|| std::env::var("USERPROFILE").ok().map(PathBuf::from))
}

fn ensure_suite_dirs(exports: &Path) -> Result<(), String> {
    fs::create_dir_all(exports).map_err(|e| e.to_string())
}

fn resolve_canvas_executable() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        let local = std::env::var("LOCALAPPDATA").ok();
        let pf = std::env::var("ProgramFiles").ok();
        let profile = std::env::var("USERPROFILE").ok();
        let mut candidates: Vec<PathBuf> = Vec::new();
        if let Some(l) = local {
            candidates.push(
                PathBuf::from(&l)
                    .join("Programs")
                    .join("ai-canvas-tool")
                    .join("AI Canvas Tool.exe"),
            );
            candidates.push(
                PathBuf::from(&l)
                    .join("Programs")
                    .join("AI Canvas Tool")
                    .join("AI Canvas Tool.exe"),
            );
        }
        if let Some(p) = pf {
            candidates.push(
                PathBuf::from(p)
                    .join("AI Canvas Tool")
                    .join("AI Canvas Tool.exe"),
            );
        }
        if let Some(h) = profile {
            candidates.push(
                PathBuf::from(&h)
                    .join("ai-canvas-tool")
                    .join("release")
                    .join("win-unpacked")
                    .join("AI Canvas Tool.exe"),
            );
            candidates.push(
                PathBuf::from(&h)
                    .join("ai-suite")
                    .join("ai-canvas-tool")
                    .join("release")
                    .join("win-unpacked")
                    .join("AI Canvas Tool.exe"),
            );
        }
        return candidates.into_iter().find(|p| p.is_file());
    }
    #[cfg(target_os = "macos")]
    {
        let mut candidates: Vec<PathBuf> = vec![
            PathBuf::from("/Applications/AI Canvas Tool.app/Contents/MacOS/AI Canvas Tool"),
        ];
        if let Some(home) = dirs_documents_home() {
            candidates.push(
                home.join("Applications")
                    .join("AI Canvas Tool.app")
                    .join("Contents/MacOS/AI Canvas Tool"),
            );
        }
        return candidates.into_iter().find(|p| p.is_file());
    }
    #[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
    {
        if let Some(home) = dirs_documents_home() {
            let candidate = home.join(".local/bin/ai-canvas-tool");
            if candidate.is_file() {
                return Some(candidate);
            }
        }
        None
    }
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
    let exports = suite.join("exports");
    if let Err(e) = ensure_suite_dirs(&exports) {
        return CanvasHandoffResult {
            ok: false,
            launched: false,
            album_art_path: None,
            handoff_path: None,
            error: Some(e),
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

    let handoff_path = suite.join("handoff.json");
    let handoff = json!({
        "version": 1,
        "timestamp": iso_now(),
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

fn iso_now() -> String {
    let ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    format!("{ms}")
}
