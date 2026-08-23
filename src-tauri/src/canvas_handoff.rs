//! AI Music Tool → AI Canvas Tool suite handoff (Tauri native).

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::OnceLock;

use chrono::Utc;
use serde::Deserialize;
use serde::Serialize;
use serde_json::json;

use crate::app_layout;

const CONFIG_JSON: &str = include_str!("../../lib/suite-handoff-paths.json");

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SuiteHandoffConfig {
    suite_path_from_home: Vec<String>,
    exports_subdir: String,
    handoff_file: String,
    canvas_candidates: CanvasCandidates,
    canvas: CanvasAddonConfig,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct CanvasAddonConfig {
    #[serde(default)]
    id: String,
    #[serde(default)]
    title: String,
    #[serde(default)]
    description: String,
    #[serde(default)]
    repo_url: String,
    #[serde(default)]
    install_url: String,
    #[serde(default)]
    releases_url: String,
    #[serde(default)]
    github_owner: String,
    #[serde(default)]
    github_repo: String,
    #[serde(default)]
    installer_candidates: CanvasCandidates,
}

#[derive(Debug, Deserialize, Default, Clone)]
struct CanvasCandidates {
    #[serde(default)]
    windows: Vec<String>,
    #[serde(default)]
    #[allow(dead_code)]
    macos: Vec<String>,
    #[serde(default)]
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

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CanvasAddonStatus {
    pub id: String,
    pub title: String,
    pub description: String,
    pub installed: bool,
    pub path: Option<String>,
    pub repo_url: Option<String>,
    pub install_url: Option<String>,
    pub releases_url: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CanvasAddonActionResult {
    pub ok: bool,
    pub launched: bool,
    pub already_installed: bool,
    pub mode: Option<String>,
    pub path: Option<String>,
    pub url: Option<String>,
    pub error: Option<String>,
}

fn config() -> &'static SuiteHandoffConfig {
    static CONFIG: OnceLock<SuiteHandoffConfig> = OnceLock::new();
    CONFIG.get_or_init(|| {
        serde_json::from_str(CONFIG_JSON).expect("parse lib/suite-handoff-paths.json")
    })
}

fn canvas_addon_config() -> Option<&'static CanvasAddonConfig> {
    Some(&config().canvas)
}

fn user_home() -> PathBuf {
    std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("."))
}

fn suite_dir() -> PathBuf {
    if let Ok(exports) = app_layout::exports_dir(None) {
        let _ = fs::create_dir_all(&exports);
        return exports;
    }
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
    if let Some(install) = app_layout::install_dir() {
        s = s.replace("$APPDIR", &install.to_string_lossy());
    }
    if let Ok(data) = app_layout::data_dir(None) {
        s = s.replace("$STUDIO_DATA", &data.to_string_lossy());
    }
    PathBuf::from(s)
}

fn looks_like_canvas_exe(path: &Path) -> bool {
    let name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    name.ends_with(".exe") && name.contains("canvas")
}

fn find_exe_in_dir(dir: &Path, depth: u8) -> Option<PathBuf> {
    if depth == 0 || !dir.is_dir() {
        return None;
    }
    let entries = fs::read_dir(dir).ok()?;
    let mut nested = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() && looks_like_canvas_exe(&path) {
            return Some(path);
        }
        if path.is_dir() {
            nested.push(path);
        }
    }
    for path in nested {
        if let Some(found) = find_exe_in_dir(&path, depth - 1) {
            return Some(found);
        }
    }
    None
}

fn colocated_canvas_executable() -> Option<PathBuf> {
    let canvas_dir = app_layout::canvas_addon_dir(None).ok()?;
    if let Some(found) = find_exe_in_dir(&canvas_dir, 3) {
        return Some(found);
    }
    let tools = app_layout::tools_dir(None).ok()?.join("canvas");
    find_exe_in_dir(&tools, 3)
}

fn platform_candidate_list(cands: &CanvasCandidates) -> &[String] {
    #[cfg(target_os = "windows")]
    {
        return &cands.windows;
    }
    #[cfg(target_os = "macos")]
    {
        return &cands.macos;
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        return &cands.linux;
    }
}

fn canvas_platform_candidates() -> &'static [String] {
    platform_candidate_list(&config().canvas_candidates)
}

fn resolve_canvas_executable() -> Option<PathBuf> {
    if let Some(local) = colocated_canvas_executable() {
        return Some(local);
    }
    canvas_platform_candidates()
        .iter()
        .map(|t| expand_path_template(t))
        .find(|p| p.is_file())
}

fn resolve_canvas_installer() -> Option<PathBuf> {
    let Some(addon) = canvas_addon_config() else {
        return None;
    };
    platform_candidate_list(&addon.installer_candidates)
        .iter()
        .map(|t| expand_path_template(t))
        .find(|p| p.is_file())
}

fn canvas_install_dest() -> PathBuf {
    app_layout::canvas_addon_dir(None).unwrap_or_else(|_| user_home().join("AI Canvas Tool"))
}

fn run_installer_into(installer: &Path, dest: &Path) -> bool {
    let _ = fs::create_dir_all(dest);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        let dest_str = dest.to_string_lossy().replace('/', "\\");
        // NSIS: /D= must be last and unquoted (even with spaces).
        let nsis = Command::new(installer)
            .arg("/S")
            .raw_arg(format!("/D={dest_str}"))
            .status();
        if nsis.map(|s| s.success()).unwrap_or(false) && colocated_canvas_executable().is_some() {
            return true;
        }
        let inno = Command::new(installer)
            .args(["/VERYSILENT", "/NORESTART"])
            .arg(format!("/DIR={dest_str}"))
            .status();
        if inno.map(|s| s.success()).unwrap_or(false) && colocated_canvas_executable().is_some() {
            return true;
        }
    }
    #[cfg(not(windows))]
    {
        let _ = installer;
        let _ = dest;
    }
    false
}

fn install_or_open_canvas_setup(installer: &Path) -> (bool, &'static str) {
    let dest = canvas_install_dest();
    if run_installer_into(installer, &dest) {
        return (true, "installed-local");
    }
    let opened = open::that(installer).is_ok();
    (opened, "local-installer")
}

fn launch_canvas_tool(handoff_file: Option<&Path>) -> bool {
    if let Some(exe) = resolve_canvas_executable() {
        let mut cmd = Command::new(exe);
        if let Some(handoff) = handoff_file {
            cmd.arg("--handoff").arg(handoff);
        }
        return cmd
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
        "m4a" | "aac" => "m4a".to_string(),
        "flac" => "flac".to_string(),
        "ogg" => "ogg".to_string(),
        _ => "mp3".to_string(),
    }
}

fn handoff_timestamp_iso() -> String {
    Utc::now().to_rfc3339()
}

fn non_empty(s: &str) -> Option<String> {
    let t = s.trim();
    if t.is_empty() {
        None
    } else {
        Some(t.to_string())
    }
}

#[tauri::command]
pub fn suite_canvas_addon_status() -> CanvasAddonStatus {
    let exe = resolve_canvas_executable();
    let addon = canvas_addon_config();
    CanvasAddonStatus {
        id: addon
            .map(|a| a.id.clone())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "canvas".to_string()),
        title: addon
            .map(|a| a.title.clone())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "AI Canvas Tool".to_string()),
        description: addon.map(|a| a.description.clone()).unwrap_or_default(),
        installed: exe.is_some(),
        path: exe.map(|p| p.to_string_lossy().into_owned()),
        repo_url: addon.and_then(|a| non_empty(&a.repo_url)),
        install_url: addon.and_then(|a| non_empty(&a.install_url)),
        releases_url: addon.and_then(|a| non_empty(&a.releases_url)),
    }
}

fn canvas_install_fallback_url(addon: &CanvasAddonConfig) -> String {
    non_empty(&addon.install_url)
        .or_else(|| non_empty(&addon.repo_url))
        .unwrap_or_else(|| "https://github.com/Druttzen/ai-canvas-tool".to_string())
}

fn canvas_releases_fallback_url(addon: &CanvasAddonConfig) -> String {
    non_empty(&addon.releases_url)
        .or_else(|| non_empty(&addon.install_url))
        .or_else(|| non_empty(&addon.repo_url))
        .unwrap_or_else(|| "https://github.com/Druttzen/ai-canvas-tool/releases".to_string())
}

#[tauri::command]
pub fn launch_canvas_addon() -> CanvasAddonActionResult {
    let handoff_path = suite_dir().join(&config().handoff_file);
    let handoff = if handoff_path.is_file() {
        Some(handoff_path.as_path())
    } else {
        None
    };
    let launched = launch_canvas_tool(handoff);
    CanvasAddonActionResult {
        ok: launched,
        launched,
        already_installed: resolve_canvas_executable().is_some(),
        mode: Some(if launched {
            "launched".to_string()
        } else {
            "missing".to_string()
        }),
        path: resolve_canvas_executable().map(|p| p.to_string_lossy().into_owned()),
        url: None,
        error: if launched {
            None
        } else {
            Some("AI Canvas Tool is not installed".to_string())
        },
    }
}

fn pick_release_asset_url(assets: &[serde_json::Value]) -> Option<(String, String)> {
    let mapped: Vec<(String, String)> = assets
        .iter()
        .filter_map(|a| {
            let name = a.get("name")?.as_str()?.to_string();
            let url = a.get("browser_download_url")?.as_str()?.to_string();
            Some((name, url))
        })
        .collect();

    #[cfg(target_os = "windows")]
    let prefer = mapped
        .iter()
        .find(|(n, _)| {
            let lower = n.to_ascii_lowercase();
            lower.contains("setup") && lower.ends_with(".exe")
        })
        .or_else(|| {
            mapped
                .iter()
                .find(|(n, _)| n.to_ascii_lowercase().ends_with(".exe"))
        });

    #[cfg(target_os = "macos")]
    let prefer = mapped.iter().find(|(n, _)| {
        let lower = n.to_ascii_lowercase();
        lower.ends_with(".dmg") || lower.ends_with(".pkg")
    });

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    let prefer = mapped.iter().find(|(n, _)| {
        let lower = n.to_ascii_lowercase();
        lower.ends_with(".appimage") || lower.ends_with(".deb")
    });

    prefer.cloned().or_else(|| mapped.first().cloned())
}

fn download_url_to_file(url: &str, dest: &Path) -> Result<(), String> {
    let client = reqwest::blocking::Client::builder()
        .user_agent("ai-music-tool-suite-addon")
        .redirect(reqwest::redirect::Policy::limited(10))
        .timeout(std::time::Duration::from_secs(180))
        .build()
        .map_err(|e| e.to_string())?;
    let mut response = client.get(url).send().map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        return Err(format!("Download failed ({})", response.status()));
    }
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let mut file = fs::File::create(dest).map_err(|e| e.to_string())?;
    std::io::copy(&mut response, &mut file).map_err(|e| e.to_string())?;
    file.flush().map_err(|e| e.to_string())?;
    Ok(())
}

fn open_fallback_page(url: String, mode: &str) -> CanvasAddonActionResult {
    let opened = open::that(&url).is_ok();
    CanvasAddonActionResult {
        ok: opened,
        launched: false,
        already_installed: false,
        mode: Some(mode.to_string()),
        path: None,
        url: Some(url),
        error: if opened {
            None
        } else {
            Some("Could not open Canvas install page".to_string())
        },
    }
}

fn install_canvas_addon_blocking() -> CanvasAddonActionResult {
    if let Some(exe) = resolve_canvas_executable() {
        return CanvasAddonActionResult {
            ok: true,
            launched: false,
            already_installed: true,
            mode: Some("installed".to_string()),
            path: Some(exe.to_string_lossy().into_owned()),
            url: None,
            error: None,
        };
    }

    if let Some(installer) = resolve_canvas_installer() {
        let (ok, mode) = install_or_open_canvas_setup(&installer);
        return CanvasAddonActionResult {
            ok,
            launched: false,
            already_installed: colocated_canvas_executable().is_some(),
            mode: Some(mode.to_string()),
            path: colocated_canvas_executable()
                .or(Some(installer.clone()))
                .map(|p| p.to_string_lossy().into_owned()),
            url: None,
            error: if ok {
                None
            } else {
                Some("Could not install Canvas into the app folder".to_string())
            },
        };
    }

    let Some(addon) = canvas_addon_config() else {
        return CanvasAddonActionResult {
            ok: false,
            launched: false,
            already_installed: false,
            mode: None,
            path: None,
            url: None,
            error: Some("No Canvas install source configured".to_string()),
        };
    };

    if addon.github_owner.is_empty() || addon.github_repo.is_empty() {
        return open_fallback_page(canvas_install_fallback_url(addon), "docs");
    }

    let api = format!(
        "https://api.github.com/repos/{}/{}/releases/latest",
        addon.github_owner, addon.github_repo
    );
    let client = match reqwest::blocking::Client::builder()
        .user_agent("ai-music-tool-suite-addon")
        .timeout(std::time::Duration::from_secs(30))
        .build()
    {
        Ok(c) => c,
        Err(err) => {
            return CanvasAddonActionResult {
                ok: false,
                launched: false,
                already_installed: false,
                mode: Some("download-failed".to_string()),
                path: None,
                url: Some(canvas_releases_fallback_url(addon)),
                error: Some(format!("Could not create HTTP client: {err}")),
            };
        }
    };

    let resp = match client
        .get(&api)
        .header("Accept", "application/vnd.github+json")
        .send()
    {
        Ok(r) => r,
        Err(err) => {
            return CanvasAddonActionResult {
                ok: false,
                launched: false,
                already_installed: false,
                mode: Some("download-failed".to_string()),
                path: None,
                url: Some(canvas_releases_fallback_url(addon)),
                error: Some(format!("Could not reach GitHub releases: {err}")),
            };
        }
    };

    let status = resp.status().as_u16();
    if status == 404 {
        return open_fallback_page(canvas_releases_fallback_url(addon), "no-release");
    }
    if !resp.status().is_success() {
        return CanvasAddonActionResult {
            ok: false,
            launched: false,
            already_installed: false,
            mode: Some("download-failed".to_string()),
            path: None,
            url: Some(canvas_releases_fallback_url(addon)),
            error: Some(format!("GitHub releases API failed ({status})")),
        };
    }

    let body = match resp.json::<serde_json::Value>() {
        Ok(v) => v,
        Err(err) => {
            return CanvasAddonActionResult {
                ok: false,
                launched: false,
                already_installed: false,
                mode: Some("download-failed".to_string()),
                path: None,
                url: Some(canvas_releases_fallback_url(addon)),
                error: Some(format!("Invalid GitHub release JSON: {err}")),
            };
        }
    };

    let Some(assets) = body.get("assets").and_then(|a| a.as_array()) else {
        return open_fallback_page(canvas_releases_fallback_url(addon), "no-release-assets");
    };
    let Some((name, url)) = pick_release_asset_url(assets) else {
        return open_fallback_page(canvas_releases_fallback_url(addon), "no-release-assets");
    };

    let dest_dir = canvas_install_dest();
    let _ = fs::create_dir_all(&dest_dir);
    let dest = dest_dir.join(&name);
    if let Err(err) = download_url_to_file(&url, &dest) {
        return CanvasAddonActionResult {
            ok: false,
            launched: false,
            already_installed: false,
            mode: Some("download-failed".to_string()),
            path: None,
            url: Some(url),
            error: Some(err),
        };
    }

    let (ok, mode) = install_or_open_canvas_setup(&dest);
    CanvasAddonActionResult {
        ok,
        launched: false,
        already_installed: colocated_canvas_executable().is_some(),
        mode: Some(if mode == "installed-local" {
            "installed".to_string()
        } else {
            "downloaded".to_string()
        }),
        path: colocated_canvas_executable()
            .or(Some(dest))
            .map(|p| p.to_string_lossy().into_owned()),
        url: None,
        error: if ok {
            None
        } else {
            Some("Downloaded installer but could not install it into the app folder".to_string())
        },
    }
}

#[tauri::command]
pub async fn install_canvas_addon() -> CanvasAddonActionResult {
    match tauri::async_runtime::spawn_blocking(install_canvas_addon_blocking).await {
        Ok(result) => result,
        Err(err) => CanvasAddonActionResult {
            ok: false,
            launched: false,
            already_installed: false,
            mode: Some("download-failed".to_string()),
            path: None,
            url: None,
            error: Some(format!("Canvas install task failed: {err}")),
        },
    }
}

#[tauri::command]
pub fn export_canvas_handoff(
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

    let launched = launch_canvas_tool(Some(&handoff_path));
    if !launched {
        // Open exports/handoff as a convenience only — do not claim Canvas launched.
        let _ = open::that(&exports).is_ok() || open::that(&handoff_path).is_ok();
    }

    CanvasHandoffResult {
        ok: true,
        launched,
        album_art_path: Some(art_path.to_string_lossy().into_owned()),
        handoff_path: Some(handoff_path.to_string_lossy().into_owned()),
        error: None,
    }
}
