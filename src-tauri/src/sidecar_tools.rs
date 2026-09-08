//! Refresh sidecar toolchain (Python / pip / base package) and optional tools under data/tools.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use tauri::AppHandle;

use crate::app_layout;
use crate::process_progress::apply_create_no_window;
use crate::python_embed::{bundled_python_version, ensure_embed_runtime, has_bundled_python_embed};
use crate::sidecar_userdata::{
    bootstrap_user_venv, ensure_user_sidecar_pkg, run_pip, user_runtime_dir, user_sidecar_root,
    user_venv_python,
};

#[derive(Debug, Clone)]
pub struct ToolRefreshItem {
    pub id: String,
    pub ok: bool,
    pub skipped: bool,
    pub message: String,
}

fn item(id: &str, ok: bool, skipped: bool, message: impl Into<String>) -> ToolRefreshItem {
    ToolRefreshItem {
        id: id.to_string(),
        ok,
        skipped,
        message: message.into(),
    }
}

fn probe_tool_version(exe: &Path, args: &[&str]) -> Option<String> {
    if !exe.is_file() {
        return None;
    }
    let mut cmd = Command::new(exe);
    cmd.args(args);
    apply_create_no_window(&mut cmd);
    let out = cmd.output().ok()?;
    let combined = format!(
        "{}{}",
        String::from_utf8_lossy(&out.stdout),
        String::from_utf8_lossy(&out.stderr)
    );
    let line = combined.lines().next()?.trim();
    if line.is_empty() {
        None
    } else {
        Some(line.chars().take(120).collect())
    }
}

fn find_named_exe(root: &Path, names: &[&str], depth: u8) -> Option<PathBuf> {
    if depth == 0 || !root.is_dir() {
        return None;
    }
    let Ok(entries) = fs::read_dir(root) else {
        return None;
    };
    let mut dirs = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() {
            let name = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_ascii_lowercase();
            if names.iter().any(|n| name == n.to_ascii_lowercase()) {
                return Some(path);
            }
        } else if path.is_dir() {
            dirs.push(path);
        }
    }
    for dir in dirs {
        if let Some(found) = find_named_exe(&dir, names, depth - 1) {
            return Some(found);
        }
    }
    None
}

/// Inventory optional native tools the user (or archives) placed under `{data}/tools`.
pub fn inventory_optional_tools(app: Option<&AppHandle>) -> Vec<ToolRefreshItem> {
    let Ok(tools) = app_layout::tools_dir(app) else {
        return vec![item(
            "tools-root",
            true,
            true,
            "Tools folder unavailable",
        )];
    };
    let _ = fs::create_dir_all(&tools);

    let mut out = Vec::new();

    #[cfg(windows)]
    let java_names = ["java.exe"];
    #[cfg(not(windows))]
    let java_names = ["java"];
    if let Some(java) = find_named_exe(&tools.join("java"), &java_names, 4)
        .or_else(|| find_named_exe(&tools, &java_names, 3))
    {
        match probe_tool_version(&java, &["-version"]) {
            Some(ver) => out.push(item(
                "java",
                true,
                false,
                format!("Java ready ({ver}) at {}", java.display()),
            )),
            None => out.push(item(
                "java",
                false,
                false,
                format!("Java binary found but -version failed ({})", java.display()),
            )),
        }
    } else {
        out.push(item(
            "java",
            true,
            true,
            "No Java toolchain under data/tools (optional — drop a JDK under tools/java)",
        ));
    }

    #[cfg(windows)]
    let ffmpeg_names = ["ffmpeg.exe"];
    #[cfg(not(windows))]
    let ffmpeg_names = ["ffmpeg"];
    if let Some(ff) = find_named_exe(&tools.join("ffmpeg"), &ffmpeg_names, 3)
        .or_else(|| find_named_exe(&tools, &ffmpeg_names, 3))
    {
        match probe_tool_version(&ff, &["-version"]) {
            Some(ver) => out.push(item(
                "ffmpeg",
                true,
                false,
                format!("FFmpeg ready ({ver}) at {}", ff.display()),
            )),
            None => out.push(item(
                "ffmpeg",
                false,
                false,
                format!("FFmpeg found but -version failed ({})", ff.display()),
            )),
        }
    } else {
        out.push(item(
            "ffmpeg",
            true,
            true,
            "No FFmpeg under data/tools (optional — place ffmpeg.exe under tools/ffmpeg)",
        ));
    }

    out
}

/// Upgrade Python runtime + pip + base editable package for Update all.
pub fn refresh_sidecar_toolchain(app: &AppHandle) -> Vec<ToolRefreshItem> {
    let mut items = Vec::new();
    let Ok(root) = user_sidecar_root(app) else {
        items.push(item(
            "python",
            false,
            false,
            "Sidecar data root unavailable",
        ));
        return items;
    };

    // Prefer bundled embed refresh; fall back to existing checkout/.venv python.
    let python = if has_bundled_python_embed(Some(app)) {
        match ensure_embed_runtime(app, &root) {
            Ok(py) => {
                items.push(item(
                    "python",
                    true,
                    false,
                    format!(
                        "Python {} ready at {}",
                        bundled_python_version(),
                        user_runtime_dir(&root).display()
                    ),
                ));
                py
            }
            Err(err) => {
                if let Some(existing) = user_venv_python(&root) {
                    items.push(item(
                        "python",
                        true,
                        false,
                        format!("Using existing Python at {} (embed refresh: {err})", existing.display()),
                    ));
                    existing
                } else {
                    items.push(item("python", false, false, err));
                    return items;
                }
            }
        }
    } else {
        match bootstrap_user_venv(app) {
            Ok(py) => {
                items.push(item(
                    "python",
                    true,
                    false,
                    format!("Python ready at {}", py.display()),
                ));
                py
            }
            Err(err) => {
                items.push(item("python", false, false, err));
                return items;
            }
        }
    };

    match run_pip(
        &python,
        &["install", "--upgrade", "pip", "setuptools", "wheel"],
        &root,
    ) {
        Ok(_) => items.push(item(
            "pip",
            true,
            false,
            "pip / setuptools / wheel upgraded",
        )),
        Err(err) => items.push(item("pip", false, false, format!("pip upgrade failed: {err}"))),
    }

    match ensure_user_sidecar_pkg(app) {
        Ok(pkg) => {
            let pkg_str = pkg.to_string_lossy().to_string();
            match run_pip(&python, &["install", "-U", "-e", &pkg_str], &root) {
                Ok(_) => items.push(item(
                    "sidecar-base",
                    true,
                    false,
                    format!("Sidecar base package upgraded ({})", pkg.display()),
                )),
                Err(err) => items.push(item(
                    "sidecar-base",
                    false,
                    false,
                    format!("Sidecar base package upgrade failed: {err}"),
                )),
            }
        }
        Err(err) => items.push(item(
            "sidecar-base",
            true,
            true,
            format!("Sidecar package sources unavailable ({err})"),
        )),
    }

    items.extend(inventory_optional_tools(Some(app)));
    items
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn find_named_exe_walks_shallow_tree() {
        let stamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("aimc-tools-{stamp}"));
        let _ = fs::remove_dir_all(&root);
        #[cfg(windows)]
        {
            let bin = root.join("java/bin");
            fs::create_dir_all(&bin).unwrap();
            fs::write(bin.join("java.exe"), b"x").unwrap();
            let found = find_named_exe(&root, &["java.exe"], 4).unwrap();
            assert!(found.ends_with("java.exe"));
        }
        #[cfg(not(windows))]
        {
            let bin = root.join("java/bin");
            fs::create_dir_all(&bin).unwrap();
            fs::write(bin.join("java"), b"x").unwrap();
            let found = find_named_exe(&root, &["java"], 4).unwrap();
            assert!(found.ends_with("java"));
        }
        let _ = fs::remove_dir_all(&root);
    }
}
