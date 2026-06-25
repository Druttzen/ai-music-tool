//! Save dialog + optional Video Creator launch for Tauri handoff.

use std::path::{Path, PathBuf};
use std::process::Command;

use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct VideoHandoffResult {
    pub ok: bool,
    pub canceled: bool,
    pub path: Option<String>,
    pub launched: bool,
    pub error: Option<String>,
}

fn resolve_video_creator_executable() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        let local = std::env::var("LOCALAPPDATA").ok();
        let pf = std::env::var("ProgramFiles").ok();
        let mut candidates: Vec<PathBuf> = Vec::new();
        if let Some(l) = local {
            candidates.push(
                PathBuf::from(l)
                    .join("Programs")
                    .join("ai-video-tool")
                    .join("AI Video Creator.exe"),
            );
        }
        if let Some(p) = pf {
            candidates.push(
                PathBuf::from(p)
                    .join("AI Video Creator")
                    .join("ai-video-tool.exe"),
            );
        }
        return candidates.into_iter().find(|p| p.is_file());
    }
    #[cfg(not(target_os = "windows"))]
    {
        None
    }
}

fn open_path(path: &Path) -> bool {
    open::that(path).is_ok()
}

#[tauri::command]
pub fn export_video_handoff(
    bundle_json: String,
    bundle_file_name: String,
    audio_bytes: Option<Vec<u8>>,
    audio_file_name: Option<String>,
) -> VideoHandoffResult {
    let default_name = if bundle_file_name.is_empty() {
        "music-video.aivbundle.json".to_string()
    } else {
        bundle_file_name
    };

    let Some(path) = rfd::FileDialog::new()
        .set_title("Send to AI Video Creator")
        .set_file_name(&default_name)
        .add_filter("Video handoff bundle", &["json"])
        .save_file()
    else {
        return VideoHandoffResult {
            ok: false,
            canceled: true,
            path: None,
            launched: false,
            error: None,
        };
    };

    if std::fs::write(&path, &bundle_json).is_err() {
        return VideoHandoffResult {
            ok: false,
            canceled: false,
            path: None,
            launched: false,
            error: Some("could not write handoff bundle".to_string()),
        };
    }

    if let (Some(bytes), Some(name)) = (audio_bytes, audio_file_name) {
        if !bytes.is_empty() && !name.is_empty() {
            let audio_path = path
                .parent()
                .unwrap_or_else(|| Path::new("."))
                .join(Path::new(&name).file_name().unwrap_or(std::ffi::OsStr::new("track.wav")));
            let _ = std::fs::write(audio_path, bytes);
        }
    }

    let mut launched = false;
    if let Some(exe) = resolve_video_creator_executable() {
        launched = Command::new(exe)
            .arg(&path)
            .spawn()
            .map(|mut child| {
                let _ = child.stdin.take();
                true
            })
            .unwrap_or(false);
    }
    if !launched {
        launched = open_path(&path);
    }

    VideoHandoffResult {
        ok: true,
        canceled: false,
        path: Some(path.to_string_lossy().into_owned()),
        launched,
        error: None,
    }
}
