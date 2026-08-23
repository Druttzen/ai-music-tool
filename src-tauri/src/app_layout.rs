//! Keep profile, sidecar extras, addons, and tools next to the installed app.
//!
//! Preferred layout (when the install folder is writable):
//! `{install}/data/{profile,sidecar,addons,tools,exports}`
//!
//! Override with `STUDIO_DATA_DIR`. If `{install}/data` is not writable
//! (typical Program Files install), fall back to the OS app-data directory.

use std::fs;
use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager};

/// Must match `identifier` in `tauri.conf.json`.
pub const STUDIO_IDENTIFIER: &str = "com.djmad.aimusiccreator.studio";

#[derive(Debug, Clone)]
pub struct StudioLayout {
    pub data: PathBuf,
    pub profile: PathBuf,
    pub sidecar: PathBuf,
    pub addons: PathBuf,
    pub tools: PathBuf,
    pub archives: PathBuf,
    pub exports: PathBuf,
}

pub fn layout_at(data: PathBuf) -> StudioLayout {
    StudioLayout {
        profile: data.join("profile"),
        sidecar: data.join("sidecar"),
        addons: data.join("addons"),
        tools: data.join("tools"),
        archives: data.join("archives"),
        exports: data.join("exports"),
        data,
    }
}

/// Directory that contains the Studio executable (or the folder beside a macOS `.app`).
pub fn install_dir_from_exe(exe: &Path) -> PathBuf {
    let Some(dir) = exe.parent().map(Path::to_path_buf) else {
        return exe.to_path_buf();
    };
    // Foo.app/Contents/MacOS → folder that contains Foo.app (sibling data dir).
    if dir.file_name().is_some_and(|name| name == "MacOS") {
        if let Some(contents) = dir.parent() {
            if contents.file_name().is_some_and(|name| name == "Contents") {
                if let Some(bundle) = contents.parent() {
                    if bundle.extension().is_some_and(|ext| ext == "app") {
                        if let Some(parent) = bundle.parent() {
                            return parent.to_path_buf();
                        }
                    }
                }
            }
        }
    }
    dir
}

pub fn install_dir() -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    Some(install_dir_from_exe(&exe))
}

pub fn preferred_data_dir(install: &Path) -> PathBuf {
    if cfg!(target_os = "macos") {
        install.join("AI Music Creator Studio Data")
    } else {
        install.join("data")
    }
}

fn dir_is_writable(path: &Path) -> bool {
    if fs::create_dir_all(path).is_err() {
        return false;
    }
    let probe = path.join(".studio-write-test");
    match fs::write(&probe, b"ok") {
        Ok(()) => {
            let _ = fs::remove_file(&probe);
            true
        }
        Err(_) => false,
    }
}

fn legacy_os_data_root() -> Option<PathBuf> {
    #[cfg(windows)]
    {
        return std::env::var_os("LOCALAPPDATA").map(|p| PathBuf::from(p).join(STUDIO_IDENTIFIER));
    }
    #[cfg(target_os = "macos")]
    {
        return std::env::var_os("HOME").map(|p| {
            PathBuf::from(p)
                .join("Library/Application Support")
                .join(STUDIO_IDENTIFIER)
        });
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        if let Some(xdg) = std::env::var_os("XDG_DATA_HOME") {
            return Some(PathBuf::from(xdg).join(STUDIO_IDENTIFIER));
        }
        return std::env::var_os("HOME")
            .map(|p| PathBuf::from(p).join(".local/share").join(STUDIO_IDENTIFIER));
    }
    #[allow(unreachable_code)]
    None
}

fn fallback_data_root(app: Option<&AppHandle>) -> Result<PathBuf, String> {
    if let Some(app) = app {
        return app
            .path()
            .app_local_data_dir()
            .map_err(|e| format!("app local data dir: {e}"));
    }
    legacy_os_data_root().ok_or_else(|| "app data dir unavailable".to_string())
}

/// Writable Studio data root (profile / sidecar / addons / tools).
pub fn data_dir(app: Option<&AppHandle>) -> Result<PathBuf, String> {
    if let Ok(raw) = std::env::var("STUDIO_DATA_DIR") {
        let path = PathBuf::from(raw.trim());
        if !path.as_os_str().is_empty() && dir_is_writable(&path) {
            return Ok(path);
        }
    }
    if let Some(install) = install_dir() {
        let candidate = preferred_data_dir(&install);
        if dir_is_writable(&candidate) {
            return Ok(candidate);
        }
    }
    fallback_data_root(app)
}

pub fn studio_layout(app: Option<&AppHandle>) -> Result<StudioLayout, String> {
    Ok(layout_at(data_dir(app)?))
}

pub fn sidecar_dir(app: Option<&AppHandle>) -> Result<PathBuf, String> {
    Ok(studio_layout(app)?.sidecar)
}

pub fn addons_dir(app: Option<&AppHandle>) -> Result<PathBuf, String> {
    Ok(studio_layout(app)?.addons)
}

pub fn tools_dir(app: Option<&AppHandle>) -> Result<PathBuf, String> {
    Ok(studio_layout(app)?.tools)
}

pub fn archives_dir(app: Option<&AppHandle>) -> Result<PathBuf, String> {
    Ok(studio_layout(app)?.archives)
}

pub fn exports_dir(app: Option<&AppHandle>) -> Result<PathBuf, String> {
    Ok(studio_layout(app)?.exports)
}

#[allow(dead_code)]
pub fn profile_dir(app: Option<&AppHandle>) -> Result<PathBuf, String> {
    Ok(studio_layout(app)?.profile)
}

pub fn canvas_addon_dir(app: Option<&AppHandle>) -> Result<PathBuf, String> {
    Ok(addons_dir(app)?.join("canvas"))
}

/// Legacy AppData sidecar from 0.50.x (used only if the new folder has no venv yet).
pub fn legacy_appdata_sidecar_root() -> Option<PathBuf> {
    Some(legacy_os_data_root()?.join("sidecar"))
}

/// Create the colocated folders and point WebView2 at `data/profile`.
pub fn prepare_app_layout() {
    let Ok(layout) = studio_layout(None) else {
        return;
    };
    for dir in [
        &layout.data,
        &layout.profile,
        &layout.sidecar,
        &layout.addons,
        &layout.tools,
        &layout.archives,
        &layout.exports,
        &layout.addons.join("canvas"),
    ] {
        let _ = fs::create_dir_all(dir);
    }
    std::env::set_var("WEBVIEW2_USER_DATA_FOLDER", &layout.profile);
    std::env::set_var("STUDIO_DATA_DIR", &layout.data);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn install_dir_from_exe_uses_parent() {
        let exe = PathBuf::from(r"C:\Apps\AI Music Creator Studio\AI Music Creator Studio.exe");
        assert_eq!(
            install_dir_from_exe(&exe),
            PathBuf::from(r"C:\Apps\AI Music Creator Studio")
        );
    }

    #[test]
    fn install_dir_from_macos_bundle_is_beside_app() {
        let exe = PathBuf::from(
            "/Applications/AI Music Creator Studio.app/Contents/MacOS/ai-music-studio",
        );
        assert_eq!(install_dir_from_exe(&exe), PathBuf::from("/Applications"));
    }

    #[test]
    fn layout_at_colocate_profile_addons_tools_sidecar() {
        let layout = layout_at(PathBuf::from("/app/data"));
        assert_eq!(layout.profile, PathBuf::from("/app/data/profile"));
        assert_eq!(layout.sidecar, PathBuf::from("/app/data/sidecar"));
        assert_eq!(layout.addons, PathBuf::from("/app/data/addons"));
        assert_eq!(layout.tools, PathBuf::from("/app/data/tools"));
        assert_eq!(layout.archives, PathBuf::from("/app/data/archives"));
        assert_eq!(layout.exports, PathBuf::from("/app/data/exports"));
    }

    #[test]
    fn preferred_windows_linux_data_is_install_slash_data() {
        if cfg!(target_os = "macos") {
            assert_eq!(
                preferred_data_dir(Path::new("/Apps")),
                PathBuf::from("/Apps/AI Music Creator Studio Data")
            );
        } else {
            assert_eq!(
                preferred_data_dir(Path::new(r"C:\Apps\Studio")),
                PathBuf::from(r"C:\Apps\Studio\data")
            );
        }
    }

    #[test]
    fn dir_is_writable_accepts_temp() {
        let stamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("aimc-layout-{stamp}"));
        assert!(dir_is_writable(&dir));
        let _ = fs::remove_dir_all(&dir);
    }
}
