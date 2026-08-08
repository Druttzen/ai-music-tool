//! User-data sidecar layout for packaged Studio extras installs.
//!
//! Layout under `{app_local_data}/sidecar/`:
//! - `pkg/` — installable ai-music-sidecar sources (from bundle resources or checkout)
//! - `.venv/` — writable venv used for uvicorn + pip extras
//! - `version.txt` — package version stamp for pkg refresh
//! - `cache/` — HF_HOME / TORCH_HOME

use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use tauri::{AppHandle, Manager};

use crate::sidecar_manager::resolve_sidecar_dir;

const PACKAGE_VERSION: &str = env!("CARGO_PKG_VERSION");

pub fn user_sidecar_root(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_local_data_dir()
        .map(|p| p.join("sidecar"))
        .map_err(|e| format!("app local data dir: {e}"))
}

/// Fallback when AppHandle is unavailable (tests / early spawn).
pub fn user_sidecar_root_fallback() -> Option<PathBuf> {
    #[cfg(windows)]
    {
        std::env::var_os("LOCALAPPDATA").map(|p| PathBuf::from(p).join("com.djmad.aimusiccreator.studio").join("sidecar"))
    }
    #[cfg(target_os = "macos")]
    {
        std::env::var_os("HOME").map(|p| {
            PathBuf::from(p)
                .join("Library/Application Support/com.djmad.aimusiccreator.studio/sidecar")
        })
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        if let Some(xdg) = std::env::var_os("XDG_DATA_HOME") {
            Some(PathBuf::from(xdg).join("com.djmad.aimusiccreator.studio/sidecar"))
        } else {
            std::env::var_os("HOME")
                .map(|p| PathBuf::from(p).join(".local/share/com.djmad.aimusiccreator.studio/sidecar"))
        }
    }
}

pub fn user_pkg_dir(root: &Path) -> PathBuf {
    root.join("pkg")
}

pub fn user_venv_dir(root: &Path) -> PathBuf {
    root.join(".venv")
}

pub fn user_cache_dir(root: &Path) -> PathBuf {
    root.join("cache")
}

pub fn user_venv_python(root: &Path) -> Option<PathBuf> {
    #[cfg(windows)]
    let py = user_venv_dir(root).join("Scripts/python.exe");
    #[cfg(not(windows))]
    let py = user_venv_dir(root).join("bin/python");
    if py.is_file() {
        Some(py)
    } else {
        None
    }
}

pub fn checkout_venv_python(sidecar_dir: &Path) -> Option<PathBuf> {
    #[cfg(windows)]
    let py = sidecar_dir.join(".venv/Scripts/python.exe");
    #[cfg(not(windows))]
    let py = sidecar_dir.join(".venv/bin/python");
    if py.is_file() {
        Some(py)
    } else {
        None
    }
}

/// Prefer system Python 3.12 → 3.11 → 3.10 (no bare python3 / 3.13+).
pub fn find_system_python_310_312() -> Option<PathBuf> {
    #[cfg(windows)]
    {
        for v in ["3.12", "3.11", "3.10"] {
            if let Ok(out) = Command::new("py")
                .args(["-", v, "-c", "import sys; print(sys.executable)"])
                .output()
            {
                if out.status.success() {
                    let path = String::from_utf8_lossy(&out.stdout).trim().to_string();
                    if !path.is_empty() && Path::new(&path).is_file() {
                        return Some(PathBuf::from(path));
                    }
                }
            }
        }
    }

    #[cfg(not(windows))]
    {
        for name in ["python3.12", "python3.11", "python3.10"] {
            if Command::new(name)
                .arg("--version")
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .status()
                .map(|s| s.success())
                .unwrap_or(false)
            {
                return Some(PathBuf::from(name));
            }
        }
    }

    None
}

/// Locate shipped or checkout package sources (`pyproject.toml` + `ai_sidecar/`).
pub fn resolve_package_source(app: Option<&AppHandle>) -> Option<PathBuf> {
    if let Some(handle) = app {
        if let Ok(resource_dir) = handle.path().resource_dir() {
            for candidate in [
                resource_dir.join("resources/ai-sidecar"),
                resource_dir.join("ai-sidecar"),
            ] {
                if package_source_ok(&candidate) {
                    return Some(candidate);
                }
            }
        }
    }

    // Dev / contributor: repo ai-sidecar next to checkout.
    if let Some(checkout) = resolve_sidecar_dir() {
        if package_source_ok(&checkout) {
            return Some(checkout);
        }
    }

    // Build-tree resources (dev without packaging).
    let manifest_res = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources/ai-sidecar");
    if package_source_ok(&manifest_res) {
        return Some(manifest_res);
    }

    None
}

pub fn package_source_ok(dir: &Path) -> bool {
    dir.join("pyproject.toml").is_file() && dir.join("ai_sidecar/main.py").is_file()
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<(), String> {
    fs::create_dir_all(dst).map_err(|e| format!("mkdir {}: {e}", dst.display()))?;
    for entry in fs::read_dir(src).map_err(|e| format!("read_dir {}: {e}", src.display()))? {
        let entry = entry.map_err(|e| format!("read_dir entry: {e}"))?;
        let ty = entry.file_type().map_err(|e| format!("file_type: {e}"))?;
        let from = entry.path();
        let to = dst.join(entry.file_name());
        if ty.is_dir() {
            // Skip heavy / non-package dirs if present in checkout copies.
            let name = entry.file_name();
            let name = name.to_string_lossy();
            if matches!(
                name.as_ref(),
                ".venv" | "__pycache__" | ".pytest_cache" | "dist" | "build" | ".ruff_cache"
            ) {
                continue;
            }
            copy_dir_recursive(&from, &to)?;
        } else if ty.is_file() {
            fs::copy(&from, &to).map_err(|e| format!("copy {} → {}: {e}", from.display(), to.display()))?;
        }
    }
    Ok(())
}

/// Ensure `pkg/` mirrors package source for the current Studio version.
pub fn ensure_user_sidecar_pkg(app: &AppHandle) -> Result<PathBuf, String> {
    let root = user_sidecar_root(app)?;
    fs::create_dir_all(&root).map_err(|e| format!("mkdir {}: {e}", root.display()))?;
    let pkg = user_pkg_dir(&root);
    let stamp = root.join("version.txt");
    let current = fs::read_to_string(&stamp).unwrap_or_default();
    let current = current.trim();

    if package_source_ok(&pkg) && current == PACKAGE_VERSION {
        return Ok(pkg);
    }

    let source = resolve_package_source(Some(app))
        .ok_or_else(|| "ai-sidecar package source not found (bundle resources or checkout)".to_string())?;

    if pkg.exists() {
        fs::remove_dir_all(&pkg).map_err(|e| format!("clear pkg: {e}"))?;
    }
    copy_dir_recursive(&source, &pkg)?;
    // Prefer copying only package files when source is a full checkout — already skipped .venv.
    if !package_source_ok(&pkg) {
        return Err(format!(
            "copied package incomplete from {} (need pyproject.toml + ai_sidecar/main.py)",
            source.display()
        ));
    }
    fs::write(&stamp, PACKAGE_VERSION).map_err(|e| format!("write version stamp: {e}"))?;
    Ok(pkg)
}

pub fn bootstrap_user_venv(app: &AppHandle) -> Result<PathBuf, String> {
    let root = user_sidecar_root(app)?;
    if let Some(existing) = user_venv_python(&root) {
        let _ = ensure_user_sidecar_pkg(app)?;
        return Ok(existing);
    }

    let system_py = find_system_python_310_312().ok_or_else(|| {
        "Need Python 3.10–3.12 on PATH to create a writable sidecar venv (py -3.12 / python3.12)"
            .to_string()
    })?;
    let pkg = ensure_user_sidecar_pkg(app)?;
    let venv = user_venv_dir(&root);
    let cache = user_cache_dir(&root);
    fs::create_dir_all(&cache).map_err(|e| format!("mkdir cache: {e}"))?;

    let status = Command::new(&system_py)
        .args(["-m", "venv"])
        .arg(&venv)
        .status()
        .map_err(|e| format!("python -m venv: {e}"))?;
    if !status.success() {
        return Err(format!("python -m venv failed (exit {status})"));
    }

    let py = user_venv_python(&root).ok_or_else(|| "venv python missing after create".to_string())?;

    run_pip(&py, &["install", "--upgrade", "pip"], &root)?;
    let pkg_str = pkg
        .to_str()
        .ok_or_else(|| "pkg path not utf-8".to_string())?
        .to_string();
    run_pip(&py, &["install", "-e", &pkg_str], &root)?;
    Ok(py)
}

pub fn run_pip(python: &Path, args: &[&str], root: &Path) -> Result<String, String> {
    let cache = user_cache_dir(root);
    let mut cmd = Command::new(python);
    cmd.arg("-m").arg("pip");
    for a in args {
        cmd.arg(a);
    }
    cmd.env("HF_HOME", cache.join("huggingface"))
        .env("TORCH_HOME", cache.join("torch"))
        .env("PIP_DISABLE_PIP_VERSION_CHECK", "1")
        .current_dir(root)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let output = cmd
        .output()
        .map_err(|e| format!("pip {:?}: {e}", args))?;
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
            format!("pip failed (exit {})", output.status)
        } else {
            tail
        })
    }
}

pub fn pip_extra_spec(extra_id: &str) -> Option<&'static str> {
    match extra_id {
        "stems" => Some("stems"),
        "generate" => Some("generate"),
        "classify" => Some("classify"),
        "vision" => Some("vision"),
        "cover" => Some("cover"),
        "cover-ref" => Some("cover-ref"),
        "vocal" => Some("vocal"),
        "vocal-rvc" => Some("vocal-rvc"),
        _ => None,
    }
}

pub fn install_extra_into_user_venv(app: &AppHandle, extra_id: &str) -> Result<String, String> {
    let root = user_sidecar_root(app)?;
    let py = bootstrap_user_venv(app)?;
    let pkg = ensure_user_sidecar_pkg(app)?;
    let spec = pip_extra_spec(extra_id).ok_or_else(|| format!("Unknown sidecar extra: {extra_id}"))?;
    let req = format!("{}[{spec}]", pkg.display());
    let mut out = run_pip(&py, &["install", "-e", &req], &root)?;
    if matches!(extra_id, "generate") {
        let ac = run_pip(&py, &["install", "audiocraft>=1.3", "--no-deps"], &root)?;
        out = format!("{out}\n{ac}");
    }
    let _ = fs::write(
        root.join("state.json"),
        format!(
            "{{\n  \"preferUserVenv\": true,\n  \"packageVersion\": \"{PACKAGE_VERSION}\",\n  \"lastExtra\": \"{extra_id}\"\n}}\n"
        ),
    );
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn package_source_ok_requires_main_and_pyproject() {
        let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../ai-sidecar");
        assert!(package_source_ok(&dir) || package_source_ok(&dir.canonicalize().unwrap_or(dir)));
    }

    #[test]
    fn pip_extra_spec_maps_allowlist() {
        assert_eq!(pip_extra_spec("generate"), Some("generate"));
        assert_eq!(pip_extra_spec("cover-ref"), Some("cover-ref"));
        assert_eq!(pip_extra_spec("nope"), None);
    }

    #[test]
    fn user_venv_python_missing_on_empty_root() {
        let tmp = std::env::temp_dir().join("aimc-sidecar-userdata-test-empty");
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();
        assert!(user_venv_python(&tmp).is_none());
        let _ = fs::remove_dir_all(&tmp);
    }
}
