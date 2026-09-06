//! Write user-facing Studio downloads into `{data}/exports/` (not OS Downloads).

use std::fs;
use std::path::{Component, Path, PathBuf};

use crate::app_layout;

/// Strip directories / `..` so exports stay under `exports_dir`.
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
    // Flat name only — no nested dirs under exports for this API.
    Ok(parts.last().cloned().unwrap_or_default())
}

#[tauri::command]
pub fn save_bytes_to_exports(file_name: String, bytes: Vec<u8>) -> Result<String, String> {
    let exports = app_layout::exports_dir(None)?;
    fs::create_dir_all(&exports).map_err(|e| format!("create exports dir: {e}"))?;
    let safe = sanitize_export_file_name(&file_name)?;
    let path: PathBuf = exports.join(&safe);
    fs::write(&path, &bytes).map_err(|e| format!("write export: {e}"))?;
    Ok(path.to_string_lossy().into_owned())
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
}
