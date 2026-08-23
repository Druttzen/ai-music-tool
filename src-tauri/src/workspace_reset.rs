//! Reset Studio workspaces to defaults on the next launch after a clean exit.

use std::fs;
use std::path::PathBuf;

use crate::app_layout;

const FLAG_NAME: &str = ".reset-workspaces-on-launch";

fn flag_path() -> Option<PathBuf> {
    app_layout::data_dir(None).ok().map(|dir| dir.join(FLAG_NAME))
}

/// Write a flag so the next launch skips restoring project/session workspaces.
pub fn arm_reset_on_launch() {
    let Some(path) = flag_path() else {
        return;
    };
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let _ = fs::write(path, b"1");
}

#[tauri::command]
pub fn workspace_reset_pending() -> bool {
    flag_path().is_some_and(|path| path.is_file())
}

#[tauri::command]
pub fn consume_workspace_reset_flag() -> bool {
    let Some(path) = flag_path() else {
        return false;
    };
    if !path.is_file() {
        return false;
    }
    let _ = fs::remove_file(&path);
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn flag_name_is_stable() {
        assert_eq!(FLAG_NAME, ".reset-workspaces-on-launch");
    }
}
