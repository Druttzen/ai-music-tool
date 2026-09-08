//! AI Music Tool → AI Canvas Tool suite handoff (Tauri native).

use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::OnceLock;

use chrono::Utc;
use serde::Deserialize;
use serde::Serialize;
use serde_json::json;
use sha2::{Digest, Sha256};

use crate::app_layout;

const CONFIG_JSON: &str = include_str!("../../lib/suite-handoff-paths.json");

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SuiteHandoffConfig {
    /// Legacy Documents/AI Suite segments (JSON compat only; Studio uses `data_dir`).
    #[allow(dead_code)]
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
    pub uninstaller_path: Option<String>,
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
    pub uninstaller_path: Option<String>,
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

#[allow(dead_code)]
fn user_home() -> PathBuf {
    std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("."))
}

fn suite_dir() -> Result<PathBuf, String> {
    let data = app_layout::data_dir(None)?;
    let _ = fs::create_dir_all(&data);
    Ok(data)
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
    if !name.ends_with(".exe") || !name.contains("canvas") {
        return false;
    }
    // Never treat the downloaded Setup/installer as the app binary.
    if name.contains("setup") || name.contains("installer") || name.contains("uninstall") {
        return false;
    }
    true
}

fn find_exe_in_dir(dir: &Path, depth: u8) -> Option<PathBuf> {
    if depth == 0 || !dir.is_dir() {
        return None;
    }
    let entries = fs::read_dir(dir).ok()?;
    let mut nested = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        let name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_ascii_lowercase();
        // Skip installer cache / hidden staging folders.
        if path.is_dir() && (name == ".cache" || name == "cache" || name.starts_with('.')) {
            continue;
        }
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
    let mut roots = vec![canvas_installer_cache_dir()];
    // Legacy: Setup.exe previously landed inside the Canvas app folder.
    roots.push(canvas_install_dest());
    roots.push(canvas_install_dest().join(".cache"));
    for root in roots {
        if let Ok(entries) = fs::read_dir(&root) {
            let mut setups: Vec<PathBuf> = entries
                .flatten()
                .map(|e| e.path())
                .filter(|p| {
                    if !p.is_file() {
                        return false;
                    }

                    let name = p
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("")
                        .to_ascii_lowercase();
                    name.ends_with(".exe")
                        && name.contains("canvas")
                        && (name.contains("setup") || name.contains("installer"))
                })
                .collect();
            setups.sort();
            if let Some(last) = setups.pop() {
                return Some(last);
            }
        }
    }
    let Some(addon) = canvas_addon_config() else {
        return None;
    };
    platform_candidate_list(&addon.installer_candidates)
        .iter()
        .map(|t| expand_path_template(t))
        .find(|p| p.is_file())
}

fn looks_like_canvas_uninstaller(path: &Path) -> bool {
    let name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    name.ends_with(".exe")
        && (name.starts_with("unins")
            || name.contains("uninstall")
            || name.contains("un-installer"))
}

fn resolve_canvas_uninstaller() -> Option<PathBuf> {
    let dest = canvas_install_dest();
    let entries = fs::read_dir(&dest).ok()?;
    let mut candidates = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() && looks_like_canvas_uninstaller(&path) {
            candidates.push(path);
        }
    }
    candidates.sort();
    candidates.pop()
}

fn canvas_install_dest() -> PathBuf {
    app_layout::canvas_addon_dir(None).unwrap_or_else(|_| {
        app_layout::data_dir(None)
            .map(|d| d.join("addons").join("canvas"))
            .unwrap_or_else(|_| PathBuf::from("addons").join("canvas"))
    })
}

/// Keep Setup.exe outside the Canvas app folder so NSIS `/D=` can own that tree.
fn canvas_installer_cache_dir() -> PathBuf {
    app_layout::archives_dir(None)
        .unwrap_or_else(|_| canvas_install_dest().join("..").join("archives"))
        .join("canvas-setup")
}

fn stage_installer_outside_dest(installer: &Path, dest: &Path) -> Result<PathBuf, String> {
    let cache = canvas_installer_cache_dir();
    fs::create_dir_all(&cache).map_err(|e| format!("canvas installer cache: {e}"))?;
    let Some(name) = installer.file_name() else {
        return Err("Installer path has no file name".to_string());
    };
    let staged = cache.join(name);
    if installer == staged || installer.starts_with(&cache) {
        return Ok(if installer.starts_with(&cache) {
            installer.to_path_buf()
        } else {
            staged
        });
    }
    if staged.exists() {
        let _ = fs::remove_file(&staged);
    }
    fs::copy(installer, &staged).map_err(|e| format!("stage installer: {e}"))?;
    // Remove in-dest copy so silent /D= can own the app folder.
    if installer.starts_with(dest) {
        let _ = fs::remove_file(installer);
    }
    Ok(staged)
}

fn find_foreign_canvas_install() -> Option<PathBuf> {
    let mut roots = Vec::new();
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        roots.push(PathBuf::from(&local).join("Programs"));
        roots.push(PathBuf::from(local));
    }
    if let Ok(pf) = std::env::var("ProgramFiles") {
        roots.push(PathBuf::from(pf));
    }
    for root in roots {
        if let Some(exe) = find_exe_in_dir(&root, 3) {
            // Only accept installs that are clearly Canvas and outside Studio data.
            if !exe.starts_with(canvas_install_dest()) {
                return exe.parent().map(|p| p.to_path_buf());
            }
        }
    }
    None
}

fn copy_dir_recursive(src: &Path, dest: &Path) -> Result<(), String> {
    fs::create_dir_all(dest).map_err(|e| format!("mkdir {}: {e}", dest.display()))?;
    for entry in fs::read_dir(src).map_err(|e| format!("read {}: {e}", src.display()))? {
        let entry = entry.map_err(|e| e.to_string())?;
        let from = entry.path();
        let to = dest.join(entry.file_name());
        if from.is_dir() {
            copy_dir_recursive(&from, &to)?;
        } else {
            fs::copy(&from, &to)
                .map_err(|e| format!("copy {} → {}: {e}", from.display(), to.display()))?;
        }
    }
    Ok(())
}

fn relocate_foreign_canvas_into(dest: &Path) -> Option<PathBuf> {
    let foreign = find_foreign_canvas_install()?;
    if copy_dir_recursive(&foreign, dest).is_err() {
        return None;
    }
    find_exe_in_dir(dest, 4)
}

fn looks_like_inno_installer(path: &Path) -> bool {
    let name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    // electron-builder / NSIS Setup must never get Inno flags (hangs on a GUI).
    name.contains("inno") || name.ends_with("-installer.exe")
}

fn cleanup_setup_exes_in_dest(dest: &Path) {
    let Ok(entries) = fs::read_dir(dest) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_ascii_lowercase();
        if name.ends_with(".exe")
            && name.contains("canvas")
            && (name.contains("setup") || name.contains("installer"))
        {
            let _ = fs::remove_file(path);
        }
    }
}

#[cfg(windows)]
fn run_silent_nsis(installer: &Path, dest: &Path) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let dest_str = dest.to_string_lossy().replace('/', "\\");
    // NSIS: /D= must be last and unquoted (even with spaces).
    let status = Command::new(installer)
        .arg("/S")
        .raw_arg(format!("/D={dest_str}"))
        .creation_flags(CREATE_NO_WINDOW)
        .status()
        .map_err(|e| format!("NSIS spawn failed: {e}"))?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("NSIS silent install exited with {status}"))
    }
}

#[cfg(windows)]
fn run_silent_inno(installer: &Path, dest: &Path) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let dest_str = dest.to_string_lossy().replace('/', "\\");
    let status = Command::new(installer)
        .args(["/VERYSILENT", "/NORESTART", "/SP-"])
        .arg(format!("/DIR={dest_str}"))
        .creation_flags(CREATE_NO_WINDOW)
        .status()
        .map_err(|e| format!("Inno spawn failed: {e}"))?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("Inno silent install exited with {status}"))
    }
}

fn run_installer_into(installer: &Path, dest: &Path) -> Result<PathBuf, String> {
    fs::create_dir_all(dest).map_err(|e| format!("create canvas dest: {e}"))?;
    let staged = stage_installer_outside_dest(installer, dest)?;

    #[cfg(windows)]
    {
        let mut errors = Vec::new();
        match run_silent_nsis(&staged, dest) {
            Ok(()) => {
                if let Some(exe) = find_exe_in_dir(dest, 4) {
                    cleanup_setup_exes_in_dest(dest);
                    return Ok(exe);
                }
                errors.push("NSIS reported success but no Canvas exe under app data dir".into());
            }
            Err(err) => errors.push(err),
        }
        // Never run Inno flags on electron-builder NSIS Setup.exe — that hangs a GUI.
        if looks_like_inno_installer(&staged) {
            match run_silent_inno(&staged, dest) {
                Ok(()) => {
                    if let Some(exe) = find_exe_in_dir(dest, 4) {
                        cleanup_setup_exes_in_dest(dest);
                        return Ok(exe);
                    }
                    errors
                        .push("Inno reported success but no Canvas exe under app data dir".into());
                }
                Err(err) => errors.push(err),
            }
        }
        if let Some(exe) = relocate_foreign_canvas_into(dest) {
            cleanup_setup_exes_in_dest(dest);
            return Ok(exe);
        }
        return Err(errors.join("; "));
    }

    #[cfg(not(windows))]
    {
        let _ = staged;
        Err("Silent Canvas install is only supported on Windows".to_string())
    }
}

fn install_or_open_canvas_setup(installer: &Path) -> (bool, &'static str, Option<String>) {
    let dest = canvas_install_dest();
    match run_installer_into(installer, &dest) {
        Ok(_) => (true, "installed-local", None),
        Err(err) => (false, "install-failed", Some(err)),
    }
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
        uninstaller_path: resolve_canvas_uninstaller().map(|p| p.to_string_lossy().into_owned()),
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
    let handoff_path = match suite_dir() {
        Ok(suite) => suite.join(&config().handoff_file),
        Err(_) => {
            return CanvasAddonActionResult {
                ok: false,
                launched: false,
                already_installed: resolve_canvas_executable().is_some(),
                mode: Some("missing".to_string()),
                path: resolve_canvas_executable().map(|p| p.to_string_lossy().into_owned()),
                uninstaller_path: resolve_canvas_uninstaller()
                    .map(|p| p.to_string_lossy().into_owned()),
                url: None,
                error: Some("Studio data directory unavailable".to_string()),
            };
        }
    };
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
        uninstaller_path: resolve_canvas_uninstaller().map(|p| p.to_string_lossy().into_owned()),
        url: None,
        error: if launched {
            None
        } else {
            Some("AI Canvas Tool is not installed".to_string())
        },
    }
}

fn pick_release_asset_url(assets: &[serde_json::Value]) -> Option<(String, String, String)> {
    let mapped: Vec<(String, String, String)> = assets
        .iter()
        .filter_map(|a| {
            let name = a.get("name")?.as_str()?.to_string();
            let url = a.get("browser_download_url")?.as_str()?.to_string();
            let digest = a
                .get("digest")?
                .as_str()?
                .strip_prefix("sha256:")?
                .to_string();
            if digest.len() != 64 || !digest.chars().all(|c| c.is_ascii_hexdigit()) {
                return None;
            }
            Some((name, url, digest))
        })
        .collect();

    #[cfg(target_os = "windows")]
    let prefer = mapped
        .iter()
        .find(|(n, _, _)| {
            let lower = n.to_ascii_lowercase();
            lower.contains("setup") && lower.ends_with(".exe")
        })
        .or_else(|| {
            mapped
                .iter()
                .find(|(n, _, _)| n.to_ascii_lowercase().ends_with(".exe"))
        });

    #[cfg(target_os = "macos")]
    let prefer = mapped.iter().find(|(n, _, _)| {
        let lower = n.to_ascii_lowercase();
        lower.ends_with(".dmg") || lower.ends_with(".pkg")
    });

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    let prefer = mapped.iter().find(|(n, _, _)| {
        let lower = n.to_ascii_lowercase();
        lower.ends_with(".appimage") || lower.ends_with(".deb")
    });

    prefer.cloned().or_else(|| mapped.first().cloned())
}

fn download_url_to_file(url: &str, dest: &Path, expected_sha256: &str) -> Result<(), String> {
    if !url.starts_with("https://github.com/") {
        return Err("Refusing Canvas installer URL outside github.com".to_string());
    }
    let client = reqwest::blocking::Client::builder()
        .user_agent("ai-music-tool-suite-addon")
        .redirect(reqwest::redirect::Policy::limited(10))
        .timeout(std::time::Duration::from_secs(180))
        .build()
        .map_err(|e| e.to_string())?;
    let response = client.get(url).send().map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        return Err(format!("Download failed ({})", response.status()));
    }
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let mut file = fs::File::create(dest).map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();
    let mut limited = response.take(512 * 1024 * 1024);
    let mut buffer = [0u8; 64 * 1024];
    loop {
        let read = limited.read(&mut buffer).map_err(|e| e.to_string())?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
        file.write_all(&buffer[..read]).map_err(|e| e.to_string())?;
    }
    file.flush().map_err(|e| e.to_string())?;
    let actual = format!("{:x}", hasher.finalize());
    if actual != expected_sha256 {
        let _ = fs::remove_file(dest);
        return Err("Downloaded Canvas installer failed SHA-256 verification".to_string());
    }
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
        uninstaller_path: None,
        url: Some(url),
        error: if opened {
            None
        } else {
            Some("Could not open Canvas install page".to_string())
        },
    }
}

fn install_canvas_addon_blocking(force: bool) -> CanvasAddonActionResult {
    if !force {
        if let Some(exe) = resolve_canvas_executable() {
            return CanvasAddonActionResult {
                ok: true,
                launched: false,
                already_installed: true,
                mode: Some("installed".to_string()),
                path: Some(exe.to_string_lossy().into_owned()),
                uninstaller_path: resolve_canvas_uninstaller()
                    .map(|p| p.to_string_lossy().into_owned()),
                url: None,
                error: None,
            };
        }

        if let Some(installer) = resolve_canvas_installer() {
            let (ok, mode, err) = install_or_open_canvas_setup(&installer);
            return CanvasAddonActionResult {
                ok,
                launched: false,
                already_installed: colocated_canvas_executable().is_some(),
                mode: Some(mode.to_string()),
                path: colocated_canvas_executable()
                    .or(Some(installer.clone()))
                    .map(|p| p.to_string_lossy().into_owned()),
                uninstaller_path: resolve_canvas_uninstaller()
                    .map(|p| p.to_string_lossy().into_owned()),
                url: None,
                error: if ok {
                    None
                } else {
                    Some(err.unwrap_or_else(|| {
                        "Could not silently install Canvas into the Studio app data folder"
                            .to_string()
                    }))
                },
            };
        }
    }

    let Some(addon) = canvas_addon_config() else {
        return CanvasAddonActionResult {
            ok: false,
            launched: false,
            already_installed: false,
            mode: None,
            path: None,
            uninstaller_path: None,
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
                uninstaller_path: None,
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
                uninstaller_path: None,
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
            uninstaller_path: None,
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
                uninstaller_path: None,
                url: Some(canvas_releases_fallback_url(addon)),
                error: Some(format!("Invalid GitHub release JSON: {err}")),
            };
        }
    };

    let Some(assets) = body.get("assets").and_then(|a| a.as_array()) else {
        return open_fallback_page(canvas_releases_fallback_url(addon), "no-release-assets");
    };
    let Some((name, url, digest)) = pick_release_asset_url(assets) else {
        return open_fallback_page(canvas_releases_fallback_url(addon), "no-release-assets");
    };

    let cache_dir = canvas_installer_cache_dir();
    let _ = fs::create_dir_all(&cache_dir);
    let dest = cache_dir.join(&name);
    let digest_path = dest.with_extension(format!(
        "{}.sha256",
        dest.extension()
            .and_then(|e| e.to_str())
            .unwrap_or_default()
    ));
    let reuse_cache = dest.is_file()
        && fs::read_to_string(&digest_path)
            .map(|cached| cached.trim() == digest)
            .unwrap_or(false);
    if reuse_cache {
        // Keep cached Setup; avoid re-downloading ~80MB on every install attempt.
    } else {
        if let Err(err) = download_url_to_file(&url, &dest, &digest) {
            return CanvasAddonActionResult {
                ok: false,
                launched: false,
                already_installed: false,
                mode: Some("download-failed".to_string()),
                path: None,
                uninstaller_path: None,
                url: Some(url),
                error: Some(err),
            };
        }
        let _ = fs::write(&digest_path, &digest);
    }

    let (ok, mode, err) = install_or_open_canvas_setup(&dest);
    CanvasAddonActionResult {
        ok,
        launched: false,
        already_installed: colocated_canvas_executable().is_some(),
        mode: Some(if mode == "installed-local" {
            "installed".to_string()
        } else {
            mode.to_string()
        }),
        path: colocated_canvas_executable()
            .or(Some(dest))
            .map(|p| p.to_string_lossy().into_owned()),
        uninstaller_path: resolve_canvas_uninstaller().map(|p| p.to_string_lossy().into_owned()),
        url: None,
        error: if ok {
            None
        } else {
            Some(err.unwrap_or_else(|| {
                "Downloaded installer but silent install into the Studio app data folder failed"
                    .to_string()
            }))
        },
    }
}

/// Refresh Canvas for Update all: keep an existing app-data install; only silent-install
/// when the exe is missing (never force-redownload Setup on every update — that freezes
/// the progress bar at the Canvas phase for minutes).
pub fn refresh_canvas_addon_blocking() -> CanvasAddonActionResult {
    if resolve_canvas_executable().is_some() {
        let result = install_canvas_addon_blocking(true);
        return CanvasAddonActionResult {
            mode: Some(if result.ok {
                "updated".to_string()
            } else {
                result.mode.unwrap_or_else(|| "update-failed".to_string())
            }),
            ..result
        };
    }

    // Update all never installs missing addons. Installation belongs to the
    // explicit Install action so an update cannot change the user's addon set.
    CanvasAddonActionResult {
        ok: true,
        launched: false,
        already_installed: false,
        mode: Some("skipped".to_string()),
        path: None,
        uninstaller_path: None,
        url: None,
        error: None,
    }
}

#[tauri::command]
pub async fn install_canvas_addon() -> CanvasAddonActionResult {
    match tauri::async_runtime::spawn_blocking(|| install_canvas_addon_blocking(false)).await {
        Ok(result) => result,
        Err(err) => CanvasAddonActionResult {
            ok: false,
            launched: false,
            already_installed: false,
            mode: Some("download-failed".to_string()),
            path: None,
            uninstaller_path: None,
            url: None,
            error: Some(format!("Canvas install task failed: {err}")),
        },
    }
}

#[tauri::command]
pub async fn uninstall_canvas_addon() -> CanvasAddonActionResult {
    let result = tauri::async_runtime::spawn_blocking(|| {
        let Some(uninstaller) = resolve_canvas_uninstaller() else {
            return CanvasAddonActionResult {
                ok: false,
                launched: false,
                already_installed: resolve_canvas_executable().is_some(),
                mode: Some("uninstaller-missing".to_string()),
                path: resolve_canvas_executable().map(|p| p.to_string_lossy().into_owned()),
                uninstaller_path: None,
                url: None,
                error: Some("AI Canvas Tool uninstall application was not found".to_string()),
            };
        };
        let launched = Command::new(&uninstaller).spawn().is_ok();
        CanvasAddonActionResult {
            ok: launched,
            launched,
            already_installed: resolve_canvas_executable().is_some(),
            mode: Some(if launched {
                "uninstall-launched".to_string()
            } else {
                "uninstall-failed".to_string()
            }),
            path: resolve_canvas_executable().map(|p| p.to_string_lossy().into_owned()),
            uninstaller_path: Some(uninstaller.to_string_lossy().into_owned()),
            url: None,
            error: if launched {
                None
            } else {
                Some("Could not launch the Canvas uninstall application".to_string())
            },
        }
    })
    .await;
    match result {
        Ok(result) => result,
        Err(err) => CanvasAddonActionResult {
            ok: false,
            launched: false,
            already_installed: false,
            mode: Some("uninstall-failed".to_string()),
            path: None,
            uninstaller_path: None,
            url: None,
            error: Some(format!("Canvas uninstall task failed: {err}")),
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

#[cfg(all(test, windows))]
mod silent_install_tests {
    use super::*;

    #[test]
    fn nsis_silent_installs_into_dest_without_inno() {
        let staged = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("target/debug/data/archives/canvas-setup/AI.Canvas.Tool-1.1.1-Setup.exe");
        let alt = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("target/debug/data/addons/canvas/AI.Canvas.Tool-1.1.1-Setup.exe");
        let installer = if staged.is_file() {
            staged
        } else if alt.is_file() {
            alt
        } else {
            eprintln!("skip: Canvas Setup.exe not present for silent install test");
            return;
        };
        let dest = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("target/debug/data/addons/canvas-silent-verify");
        let _ = fs::remove_dir_all(&dest);
        let exe = run_installer_into(&installer, &dest).expect("silent NSIS install");
        assert!(exe.is_file(), "expected Canvas exe at {}", exe.display());
        assert!(
            exe.starts_with(&dest),
            "exe must live under app data dest: {}",
            exe.display()
        );
        // Setup must not remain in the app folder.
        let leftover = fs::read_dir(&dest).unwrap().flatten().any(|e| {
            let n = e.file_name().to_string_lossy().to_ascii_lowercase();
            n.contains("setup") && n.ends_with(".exe")
        });
        assert!(!leftover, "Setup.exe must not remain in Canvas app dir");
    }
}
