//! Write user-facing Studio downloads into `{data}/exports/` (not OS Downloads),
//! or into a folder the user picks in Studio export.

use std::fs;
use std::path::{Component, Path, PathBuf};
use std::time::Duration;

use tauri::{AppHandle, Manager};

use crate::app_layout;

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

/// Write `file_name` (basename only) into `dir`.
pub fn write_export_bytes(dir: &Path, file_name: &str, bytes: &[u8]) -> Result<PathBuf, String> {
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
    if !path.starts_with(dir) {
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
    let dir = match directory
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        Some(raw) => resolve_export_dir(raw)?,
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

    Ok(picked.map(|p| p.to_string_lossy().into_owned()))
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
}
