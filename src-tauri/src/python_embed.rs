//! Bundled Windows embeddable CPython under `{install}/data/sidecar/runtime/`.
//!
//! Packaged Studio unpacks `resources/python-embed/python-*-embed-amd64.zip`,
//! enables `import site`, runs get-pip.py, then installs the sidecar package.
//! No Windows `py` launcher / PATH Python is required on the packaged path.

use std::fs;
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Duration;

use tauri::{AppHandle, Manager};

use crate::process_progress::{apply_create_no_window, run_command_streaming};
use crate::studio_component_update::extract_zip_archive;

const EMBED_ZIP_NAME: &str = "python-3.12.10-embed-amd64.zip";
const GET_PIP_NAME: &str = "get-pip.py";
const PYTHON_VERSION_STAMP: &str = "3.12.10";

pub fn user_runtime_dir(root: &Path) -> PathBuf {
    root.join("runtime")
}

/// Prefer embeddable `runtime/python.exe`, then legacy `.venv`.
pub fn resolve_user_python(root: &Path) -> Option<PathBuf> {
    #[cfg(windows)]
    {
        let runtime = user_runtime_dir(root).join("python.exe");
        if runtime.is_file() {
            return Some(runtime);
        }
        let venv = root.join(".venv/Scripts/python.exe");
        if venv.is_file() {
            return Some(venv);
        }
    }
    #[cfg(not(windows))]
    {
        let runtime = user_runtime_dir(root).join("bin/python");
        if runtime.is_file() {
            return Some(runtime);
        }
        let venv = root.join(".venv/bin/python");
        if venv.is_file() {
            return Some(venv);
        }
    }
    None
}

/// Locate bundled embed zip next to get-pip.py (resources or build-tree).
pub fn resolve_python_embed_dir(app: Option<&AppHandle>) -> Option<PathBuf> {
    let mut candidates = Vec::new();
    if let Some(handle) = app {
        if let Ok(resource_dir) = handle.path().resource_dir() {
            candidates.push(resource_dir.join("resources/python-embed"));
            candidates.push(resource_dir.join("python-embed"));
        }
    }
    candidates.push(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources/python-embed"));
    candidates.into_iter().find(|dir| dir.join(EMBED_ZIP_NAME).is_file())
}

pub fn has_bundled_python_embed(app: Option<&AppHandle>) -> bool {
    resolve_python_embed_dir(app).is_some()
}

fn enable_import_site(runtime: &Path) -> Result<(), String> {
    let Ok(entries) = fs::read_dir(runtime) else {
        return Err(format!("read runtime dir {}", runtime.display()));
    };
    let mut patched = false;
    for entry in entries.flatten() {
        let path = entry.path();
        let name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_ascii_lowercase();
        if !(name.starts_with("python") && name.ends_with("._pth")) {
            continue;
        }
        let raw = fs::read_to_string(&path).map_err(|e| format!("read {}: {e}", path.display()))?;
        let mut lines: Vec<String> = raw.lines().map(|l| l.to_string()).collect();
        let mut changed = false;
        for line in &mut lines {
            let trimmed = line.trim();
            if trimmed == "#import site" {
                *line = "import site".to_string();
                changed = true;
            }
        }
        if !lines.iter().any(|l| l.trim() == "import site") {
            lines.push("import site".to_string());
            changed = true;
        }
        // Allow pip / sidecar packages beside the embed root.
        if !lines.iter().any(|l| l.trim() == "Lib\\site-packages" || l.trim() == "Lib/site-packages") {
            lines.push("Lib\\site-packages".to_string());
            changed = true;
        }
        if changed {
            let mut out = lines.join("\n");
            if !out.ends_with('\n') {
                out.push('\n');
            }
            fs::write(&path, out).map_err(|e| format!("write {}: {e}", path.display()))?;
        }
        patched = true;
    }
    if !patched {
        return Err(format!("no python*._pth under {}", runtime.display()));
    }
    Ok(())
}

fn run_hidden_python(python: &Path, args: &[&str], cwd: &Path) -> Result<String, String> {
    let mut cmd = Command::new(python);
    for a in args {
        cmd.arg(a);
    }
    cmd.current_dir(cwd)
        .env("PYTHONUNBUFFERED", "1")
        .env("PIP_DISABLE_PIP_VERSION_CHECK", "1");
    apply_create_no_window(&mut cmd);
    let output = run_command_streaming(cmd, Duration::from_secs(20 * 60), |_| {})?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let combined = format!("{stdout}{stderr}");
    if output.status.success() {
        Ok(combined)
    } else {
        let tail: String = combined
            .lines()
            .rev()
            .take(16)
            .collect::<Vec<_>>()
            .into_iter()
            .rev()
            .collect::<Vec<_>>()
            .join("\n");
        Err(if tail.is_empty() {
            format!("python command failed (exit {})", output.status)
        } else {
            tail
        })
    }
}

/// Unpack embed zip into `{root}/runtime`, enable site, install pip if missing.
/// Re-extracts when the bundled stamp differs from `AIMUSIC_PYTHON_VERSION.txt`.
pub fn ensure_embed_runtime(app: &AppHandle, root: &Path) -> Result<PathBuf, String> {
    #[cfg(not(windows))]
    {
        let _ = app;
        if let Some(existing) = resolve_user_python(root) {
            return Ok(existing);
        }
        return Err(
            "Bundled embeddable CPython is Windows-only — use a checkout .venv or system Python 3.10–3.12"
                .to_string(),
        );
    }

    #[cfg(windows)]
    {
        let runtime = user_runtime_dir(root);
        let stamp = runtime.join("AIMUSIC_PYTHON_VERSION.txt");
        let stamp_ok = fs::read_to_string(&stamp)
            .map(|s| s.trim() == PYTHON_VERSION_STAMP)
            .unwrap_or(false);
        if runtime.join("python.exe").is_file() && stamp_ok {
            enable_import_site(&runtime)?;
            return Ok(runtime.join("python.exe"));
        }

        let embed_dir = resolve_python_embed_dir(Some(app)).ok_or_else(|| {
            "Bundled python-embed zip not found (resources/python-embed) — rebuild with npm run fetch:python-embed"
                .to_string()
        })?;
        let zip_path = embed_dir.join(EMBED_ZIP_NAME);
        let get_pip = embed_dir.join(GET_PIP_NAME);
        if !get_pip.is_file() {
            return Err(format!("get-pip.py missing next to {}", zip_path.display()));
        }

        fs::create_dir_all(root).map_err(|e| format!("mkdir {}: {e}", root.display()))?;
        if runtime.exists() {
            let _ = fs::remove_dir_all(&runtime);
        }
        extract_zip_archive(&zip_path, &runtime)?;
        fs::write(&stamp, format!("{PYTHON_VERSION_STAMP}\n"))
            .map_err(|e| format!("write python stamp: {e}"))?;
        enable_import_site(&runtime)?;

        let python = runtime.join("python.exe");
        if !python.is_file() {
            return Err(format!("python.exe missing after extract in {}", runtime.display()));
        }

        let get_pip_local = runtime.join(GET_PIP_NAME);
        if !get_pip_local.is_file() {
            fs::copy(&get_pip, &get_pip_local).map_err(|e| format!("copy get-pip: {e}"))?;
        }

        let pip_ok = run_hidden_python(&python, &["-m", "pip", "--version"], &runtime).is_ok();
        if !pip_ok {
            let _ = run_hidden_python(
                &python,
                &[GET_PIP_NAME, "--no-warn-script-location"],
                &runtime,
            )?;
        }
        Ok(python)
    }
}

pub fn bundled_python_version() -> &'static str {
    PYTHON_VERSION_STAMP
}

pub fn write_runtime_readme(runtime: &Path) -> io::Result<()> {
    let note = runtime.join("README-AIMUSIC.txt");
    let mut f = fs::File::create(note)?;
    writeln!(
        f,
        "AI Music Creator Studio — bundled embeddable CPython {PYTHON_VERSION_STAMP}\n\
         Do not replace with another app's Python. Managed by Studio first-run bootstrap."
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolve_user_python_prefers_runtime_over_venv() {
        let stamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("aimc-py-resolve-{stamp}"));
        let _ = fs::remove_dir_all(&root);
        #[cfg(windows)]
        {
            fs::create_dir_all(root.join("runtime")).unwrap();
            fs::create_dir_all(root.join(".venv/Scripts")).unwrap();
            fs::write(root.join(".venv/Scripts/python.exe"), b"legacy").unwrap();
            let legacy = resolve_user_python(&root).unwrap();
            assert!(
                legacy.ends_with(".venv\\Scripts\\python.exe")
                    || legacy.ends_with(".venv/Scripts/python.exe")
            );
            fs::write(root.join("runtime/python.exe"), b"embed").unwrap();
            let py = resolve_user_python(&root).unwrap();
            assert!(py.ends_with("runtime\\python.exe") || py.ends_with("runtime/python.exe"));
        }
        #[cfg(not(windows))]
        {
            fs::create_dir_all(root.join("runtime/bin")).unwrap();
            fs::create_dir_all(root.join(".venv/bin")).unwrap();
            fs::write(root.join(".venv/bin/python"), b"legacy").unwrap();
            fs::write(root.join("runtime/bin/python"), b"embed").unwrap();
            let py = resolve_user_python(&root).unwrap();
            assert!(py.ends_with("runtime/bin/python"));
        }
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn enable_import_site_uncomments_pth() {
        let stamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let runtime = std::env::temp_dir().join(format!("aimc-pth-{stamp}"));
        let _ = fs::remove_dir_all(&runtime);
        fs::create_dir_all(&runtime).unwrap();
        let pth = runtime.join("python312._pth");
        fs::write(&pth, "python312.zip\n.\n#import site\n").unwrap();
        enable_import_site(&runtime).unwrap();
        let body = fs::read_to_string(&pth).unwrap();
        assert!(body.contains("import site"));
        assert!(!body.contains("#import site"));
        assert!(body.contains("Lib\\site-packages") || body.contains("Lib/site-packages"));
        let _ = fs::remove_dir_all(&runtime);
    }
}
