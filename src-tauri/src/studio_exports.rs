//! Write user-facing Studio downloads into `{data}/exports/` (not OS Downloads),
//! or into a folder the user picks in Studio export.

use std::fs;
use std::path::{Component, Path, PathBuf};
use std::time::Duration;

use tauri::{AppHandle, Manager};

use crate::app_layout;

/// Match DSP input cap — renderer must not dump unbounded blobs to disk.
pub const MAX_EXPORT_BYTES: usize = 512 * 1024 * 1024;

const ALLOWLIST_FILE: &str = "export-destinations.json";

/// Strip directories / `..` so the file name cannot escape the destination folder.
pub fn sanitize_export_file_name(raw: &str) -> Result<String, String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err("export file name is empty".to_string());
    }
    let path = Path::new(trimmed);
    if path.is_absolute() {
        return Err("export file name must be relative".to_string());
    }
    let mut parts = Vec::new();
    for component in path.components() {
        match component {
            Component::Normal(os) => {
                let s = os.to_string_lossy();
                if s.is_empty() || s == "." || s == ".." {
                    return Err("export file name is invalid".to_string());
                }
                parts.push(s.into_owned());
            }
            Component::CurDir => {}
            _ => return Err("export file name must not contain path segments".to_string()),
        }
    }
    if parts.is_empty() {
        return Err("export file name is empty".to_string());
    }
    // Flat name only — no nested dirs under the destination for this API.
    Ok(parts.last().cloned().unwrap_or_default())
}

fn resolve_export_dir(raw: &str) -> Result<PathBuf, String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err("export directory is empty".to_string());
    }
    if trimmed.contains('\0') {
        return Err("export directory is invalid".to_string());
    }
    let path = PathBuf::from(trimmed);
    if !path.is_absolute() {
        return Err("export directory must be absolute".to_string());
    }
    Ok(path)
}

fn paths_match(a: &Path, b: &Path) -> bool {
    if a == b {
        return true;
    }
    match (fs::canonicalize(a), fs::canonicalize(b)) {
        (Ok(left), Ok(right)) => left == right,
        _ => false,
    }
}

/// True when `dir` is the default Studio exports folder or a previously picked folder.
pub fn export_dir_is_allowed_in(dir: &Path, allowed: &[PathBuf], default_exports: &Path) -> bool {
    paths_match(dir, default_exports) || allowed.iter().any(|item| paths_match(dir, item))
}

fn allowlist_file() -> Result<PathBuf, String> {
    Ok(app_layout::data_dir(None)?.join(ALLOWLIST_FILE))
}

fn load_allowed_export_dirs() -> Vec<PathBuf> {
    let Ok(path) = allowlist_file() else {
        return Vec::new();
    };
    let Ok(raw) = fs::read_to_string(path) else {
        return Vec::new();
    };
    let Ok(list) = serde_json::from_str::<Vec<String>>(&raw) else {
        return Vec::new();
    };
    list.into_iter()
        .map(PathBuf::from)
        .filter(|p| p.is_absolute())
        .collect()
}

fn save_allowed_export_dirs(dirs: &[PathBuf]) {
    let Ok(path) = allowlist_file() else {
        return;
    };
    let payload: Vec<String> = dirs
        .iter()
        .map(|p| p.to_string_lossy().into_owned())
        .collect();
    if let Ok(json) = serde_json::to_string_pretty(&payload) {
        let _ = fs::write(path, json);
    }
}

fn remember_export_directory(dir: &Path) -> Result<PathBuf, String> {
    let resolved = resolve_export_dir(&dir.to_string_lossy())?;
    if !resolved.is_dir() {
        return Err("export destination is not a folder".to_string());
    }
    let canon = fs::canonicalize(&resolved).unwrap_or(resolved);
    let mut dirs = load_allowed_export_dirs();
    if !dirs.iter().any(|item| paths_match(item, &canon)) {
        dirs.push(canon.clone());
        save_allowed_export_dirs(&dirs);
    }
    Ok(canon)
}

fn export_dir_is_allowed(dir: &Path) -> bool {
    let default = app_layout::exports_dir(None).ok();
    let allowed = load_allowed_export_dirs();
    match default {
        Some(exports) => export_dir_is_allowed_in(dir, &allowed, &exports),
        None => allowed.iter().any(|item| paths_match(dir, item)),
    }
}

/// Write `file_name` (basename only) into `dir`.
pub fn write_export_bytes(dir: &Path, file_name: &str, bytes: &[u8]) -> Result<PathBuf, String> {
    if bytes.len() > MAX_EXPORT_BYTES {
        return Err("export payload exceeds the 512 MiB limit".to_string());
    }
    if !dir.is_absolute() {
        return Err("export directory must be absolute".to_string());
    }
    fs::create_dir_all(dir).map_err(|e| format!("create exports dir: {e}"))?;
    let meta = fs::metadata(dir).map_err(|e| format!("read export dir: {e}"))?;
    if !meta.is_dir() {
        return Err("export destination is not a folder".to_string());
    }
    let safe = sanitize_export_file_name(file_name)?;
    let path: PathBuf = dir.join(&safe);
    let parent = path.parent().unwrap_or(dir);
    if !paths_match(parent, dir) && !path.starts_with(dir) {
        return Err("export path escaped destination folder".to_string());
    }
    fs::write(&path, bytes).map_err(|e| format!("write export: {e}"))?;
    Ok(path)
}

#[tauri::command]
pub fn get_exports_dir() -> Result<String, String> {
    Ok(app_layout::exports_dir(None)?.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn save_bytes_to_exports(
    file_name: String,
    bytes: Vec<u8>,
    directory: Option<String>,
) -> Result<String, String> {
    if bytes.len() > MAX_EXPORT_BYTES {
        return Err("export payload exceeds the 512 MiB limit".to_string());
    }
    let dir = match directory
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        Some(raw) => {
            let resolved = resolve_export_dir(raw)?;
            if !export_dir_is_allowed(&resolved) {
                return Err(
                    "export folder is not allowed — choose a folder in Studio export".to_string(),
                );
            }
            resolved
        }
        None => app_layout::exports_dir(None)?,
    };
    let path = write_export_bytes(&dir, &file_name, &bytes)?;
    Ok(path.to_string_lossy().into_owned())
}

#[tauri::command]
pub async fn pick_export_directory(
    app: AppHandle,
    current: Option<String>,
) -> Result<Option<String>, String> {
    let window = app.get_webview_window("main");
    let was_fullscreen = window
        .as_ref()
        .and_then(|w| w.is_fullscreen().ok())
        .unwrap_or(false);
    if was_fullscreen {
        if let Some(w) = &window {
            let _ = w.set_fullscreen(false);
        }
        tokio::time::sleep(Duration::from_millis(80)).await;
    }

    let start_dir = current
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(PathBuf::from)
        .filter(|p| p.is_dir());
    let parent = window.clone();

    let picked = tauri::async_runtime::spawn_blocking(move || {
        let mut dlg = rfd::FileDialog::new().set_title("Choose Studio export folder");
        if let Some(dir) = start_dir {
            dlg = dlg.set_directory(dir);
        }
        if let Some(ref w) = parent {
            dlg = dlg.set_parent(w);
        }
        dlg.pick_folder()
    })
    .await
    .map_err(|e| format!("export folder picker: {e}"))?;

    if was_fullscreen {
        if let Some(w) = &window {
            let _ = w.set_fullscreen(true);
        }
    }

    match picked {
        Some(path) => {
            let remembered = remember_export_directory(&path)?;
            Ok(Some(remembered.to_string_lossy().into_owned()))
        }
        None => Ok(None),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitize_keeps_basename_only() {
        assert_eq!(
            sanitize_export_file_name("track-enhanced-streaming.wav").unwrap(),
            "track-enhanced-streaming.wav"
        );
        assert_eq!(
            sanitize_export_file_name("nested/foo.wav").unwrap(),
            "foo.wav"
        );
    }

    #[test]
    fn sanitize_rejects_traversal_and_absolute() {
        assert!(sanitize_export_file_name("").is_err());
        assert!(sanitize_export_file_name("..").is_err());
        assert!(sanitize_export_file_name("../x.wav").is_err());
        #[cfg(windows)]
        assert!(sanitize_export_file_name(r"C:\Windows\x.wav").is_err());
        #[cfg(not(windows))]
        assert!(sanitize_export_file_name("/etc/passwd").is_err());
    }

    #[test]
    fn resolve_export_dir_requires_absolute() {
        assert!(resolve_export_dir("").is_err());
        assert!(resolve_export_dir("relative/out").is_err());
        #[cfg(windows)]
        assert!(resolve_export_dir(r"C:\Music\Exports").is_ok());
        #[cfg(not(windows))]
        assert!(resolve_export_dir("/tmp/exports").is_ok());
    }

    #[test]
    fn write_export_bytes_uses_custom_dir_and_basename() {
        let dir = std::env::temp_dir().join(format!(
            "aimc-export-dest-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0)
        ));
        fs::create_dir_all(&dir).unwrap();
        let path = write_export_bytes(&dir, "nested/out.wav", b"hi").unwrap();
        assert_eq!(path.file_name().unwrap(), "out.wav");
        assert_eq!(fs::read(&path).unwrap(), b"hi");
        let _ = fs::remove_file(&path);
        let _ = fs::remove_dir(&dir);
    }

    #[test]
    fn write_export_bytes_rejects_oversize_payload() {
        let dir = std::env::temp_dir();
        let too_big = vec![0u8; MAX_EXPORT_BYTES + 1];
        assert!(write_export_bytes(&dir, "x.wav", &too_big).is_err());
    }

    #[test]
    fn allowlist_accepts_default_and_remembered_dirs() {
        let default = std::env::temp_dir().join("aimc-default-exports");
        let picked = std::env::temp_dir().join("aimc-picked-exports");
        fs::create_dir_all(&default).unwrap();
        fs::create_dir_all(&picked).unwrap();
        assert!(export_dir_is_allowed_in(&default, &[], &default));
        assert!(!export_dir_is_allowed_in(&picked, &[], &default));
        assert!(export_dir_is_allowed_in(&picked, &[picked.clone()], &default));
        let _ = fs::remove_dir(&default);
        let _ = fs::remove_dir(&picked);
    }
}
