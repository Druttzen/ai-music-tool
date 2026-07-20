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

const CONFIG_JSON: &str = include_str!("../../lib/suite-handoff-paths.json");

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SuiteHandoffConfig {
    suite_path_from_home: Vec<String>,
    exports_subdir: String,
    handoff_file: String,
    canvas_candidates: CanvasCandidates,
    #[serde(default)]
    addons: SuiteAddons,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct SuiteAddons {
    #[serde(default)]
    canvas: Option<CanvasAddonConfig>,
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
    config().addons.canvas.as_ref()
}

fn user_home() -> PathBuf {
    std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("."))
}

fn downloads_dir() -> PathBuf {
    user_home().join("Downloads")
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
        .find(|(n, _)| n.to_ascii_lowercase().contains("setup") && n.ends_with(".exe"))
        .or_else(|| mapped.iter().find(|(n, _)| n.ends_with(".exe")));

    #[cfg(target_os = "macos")]
    let prefer = mapped
        .iter()
        .find(|(n, _)| n.ends_with(".dmg") || n.ends_with(".pkg"));

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    let prefer = mapped
        .iter()
        .find(|(n, _)| n.ends_with(".AppImage") || n.ends_with(".deb"));

    prefer
        .cloned()
        .or_else(|| mapped.first().cloned())
}

fn download_url_to_file(url: &str, dest: &Path) -> Result<(), String> {
    let client = reqwest::blocking::Client::builder()
        .user_agent("ai-music-tool-suite-addon")
        .redirect(reqwest::redirect::Policy::limited(10))
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

#[tauri::command]
pub fn install_canvas_addon() -> CanvasAddonActionResult {
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
        let opened = open::that(&installer).is_ok();
        return CanvasAddonActionResult {
            ok: opened,
            launched: false,
            already_installed: false,
            mode: Some("local-installer".to_string()),
            path: Some(installer.to_string_lossy().into_owned()),
            url: None,
            error: if opened {
                None
            } else {
                Some("Could not open local Canvas installer".to_string())
            },
        };
    }

    if let Some(addon) = canvas_addon_config() {
        let mut release_http_status: Option<u16> = None;
        if !addon.github_owner.is_empty() && !addon.github_repo.is_empty() {
            let api = format!(
                "https://api.github.com/repos/{}/{}/releases/latest",
                addon.github_owner, addon.github_repo
            );
            if let Ok(client) = reqwest::blocking::Client::builder()
                .user_agent("ai-music-tool-suite-addon")
                .build()
            {
                if let Ok(resp) = client
                    .get(&api)
                    .header("Accept", "application/vnd.github+json")
                    .send()
                {
                    release_http_status = Some(resp.status().as_u16());
                    if resp.status().is_success() {
                        if let Ok(body) = resp.json::<serde_json::Value>() {
                            if let Some(assets) = body.get("assets").and_then(|a| a.as_array()) {
                                if let Some((name, url)) = pick_release_asset_url(assets) {
                                    let dest = downloads_dir().join(name);
                                    if download_url_to_file(&url, &dest).is_ok() {
                                        let opened = open::that(&dest).is_ok();
                                        return CanvasAddonActionResult {
                                            ok: opened,
                                            launched: false,
                                            already_installed: false,
                                            mode: Some("downloaded".to_string()),
                                            path: Some(dest.to_string_lossy().into_owned()),
                                            url: None,
                                            error: if opened {
                                                None
                                            } else {
                                                Some("Downloaded installer but could not open it".to_string())
                                            },
                                        };
                                    }
                                }
                                release_http_status = Some(200);
                            }
                        }
                    }
                }
            }
        }

        let url = canvas_install_fallback_url(addon);
        let mode = if release_http_status == Some(404) {
            "no-release"
        } else if release_http_status == Some(200) {
            "no-release-assets"
        } else {
            "docs"
        };
        let opened = open::that(&url).is_ok();
        return CanvasAddonActionResult {
            ok: opened,
            launched: false,
            already_installed: false,
            mode: Some(mode.to_string()),
            path: None,
            url: Some(url),
            error: if opened {
                None
            } else {
                Some("Could not open Canvas install instructions".to_string())
            },
        };
    }

    CanvasAddonActionResult {
        ok: false,
        launched: false,
        already_installed: false,
        mode: None,
        path: None,
        url: None,
        error: Some("No Canvas install source configured".to_string()),
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
