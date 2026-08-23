//! User-data sidecar layout for packaged Studio extras installs.
//!
//! Layout under `{install}/data/sidecar/` (see `app_layout`):
//! - `pkg/` — installable ai-music-sidecar sources (from bundle resources or checkout)
//! - `.venv/` — writable venv used for uvicorn + pip extras
//! - `version.txt` — package version stamp for pkg refresh
//! - `cache/` — HF_HOME / TORCH_HOME

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
#[cfg(not(windows))]
use std::process::Stdio;
use std::time::Duration;

use tauri::{AppHandle, Manager};

use crate::app_layout;
use crate::process_progress::{
    emit_install_progress, parse_pip_progress_bytes, run_command_streaming,
};
use crate::sidecar_manager::resolve_sidecar_dir;

const PACKAGE_VERSION: &str = env!("CARGO_PKG_VERSION");

pub fn user_sidecar_root(app: &AppHandle) -> Result<PathBuf, String> {
    app_layout::sidecar_dir(Some(app))
}

/// Fallback when AppHandle is unavailable (tests / early spawn).
pub fn user_sidecar_root_fallback() -> Option<PathBuf> {
    app_layout::sidecar_dir(None)
        .ok()
        .or_else(app_layout::legacy_appdata_sidecar_root)
}

/// Prefer the colocated venv; keep a previous AppData venv alive until extras are reinstalled.
pub fn user_sidecar_runtime_root(app: &AppHandle) -> Result<PathBuf, String> {
    let primary = user_sidecar_root(app)?;
    if user_venv_python(&primary).is_some() {
        return Ok(primary);
    }
    if let Some(legacy) = app_layout::legacy_appdata_sidecar_root() {
        if legacy != primary && user_venv_python(&legacy).is_some() {
            return Ok(legacy);
        }
    }
    Ok(primary)
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

/// Version stamp from `version.txt` or `state.json` `packageVersion`.
pub fn user_sidecar_version_stamp(root: &Path) -> Option<String> {
    if let Ok(raw) = fs::read_to_string(root.join("version.txt")) {
        let trimmed = raw.trim();
        if !trimmed.is_empty() {
            return Some(trimmed.to_string());
        }
    }
    let raw = fs::read_to_string(root.join("state.json")).ok()?;
    let value: serde_json::Value = serde_json::from_str(&raw).ok()?;
    value
        .get("packageVersion")
        .or_else(|| value.get("package_version"))
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(ToString::to_string)
}

pub fn user_sidecar_stamp_matches_package(root: &Path) -> bool {
    user_sidecar_version_stamp(root).as_deref() == Some(PACKAGE_VERSION)
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

/// Windows `py` launcher version flag. Must be one argv token (`-3.10`), never `py - 3.10`.
pub fn py_launcher_version_flag(version: &str) -> String {
    format!("-{version}")
}

/// Prefer system Python 3.12 → 3.11 → 3.10 (no bare python3 / 3.13+).
pub fn find_system_python_310_312() -> Option<PathBuf> {
    #[cfg(windows)]
    {
        // py launcher needs a single `-3.10` flag — `py - 3.10` opens the default REPL.
        for v in ["3.12", "3.11", "3.10"] {
            let flag = py_launcher_version_flag(v);
            if let Ok(out) = Command::new("py")
                .args([&flag, "-c", "import sys; print(sys.executable)"])
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
        // Fallback when `py` is missing but a versioned install is on PATH / common layout.
        for name in ["python3.12", "python3.11", "python3.10"] {
            if let Some(p) = resolve_windows_python_exe(name) {
                return Some(p);
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

#[cfg(windows)]
fn resolve_windows_python_exe(name: &str) -> Option<PathBuf> {
    if let Ok(out) = Command::new("where").arg(name).output() {
        if out.status.success() {
            let first = String::from_utf8_lossy(&out.stdout)
                .lines()
                .next()
                .unwrap_or("")
                .trim()
                .to_string();
            if !first.is_empty() && Path::new(&first).is_file() {
                return Some(PathBuf::from(first));
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
                ".venv"
                    | "__pycache__"
                    | ".pytest_cache"
                    | "dist"
                    | "build"
                    | ".ruff_cache"
                    | "tests"
                    | ".artifacts"
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

/// Overlay package sources onto `pkg/`. Never wipe a live directory (Windows file locks).
pub fn ensure_user_sidecar_pkg(app: &AppHandle) -> Result<PathBuf, String> {
    let root = user_sidecar_root(app)?;
    fs::create_dir_all(&root).map_err(|e| format!("mkdir {}: {e}", root.display()))?;
    let pkg = user_pkg_dir(&root);
    let stamp = root.join("version.txt");

    let source = resolve_package_source(Some(app))
        .ok_or_else(|| "ai-sidecar package source not found (bundle resources or checkout)".to_string())?;

    match copy_dir_recursive(&source, &pkg) {
        Ok(()) => {
            if !package_source_ok(&pkg) {
                return Err(format!(
                    "copied package incomplete from {} (need pyproject.toml + ai_sidecar/main.py)",
                    source.display()
                ));
            }
            fs::write(&stamp, PACKAGE_VERSION).map_err(|e| format!("write version stamp: {e}"))?;
            Ok(pkg)
        }
        Err(err) if package_source_ok(&pkg) => {
            // Keep the last working sources if a copy is locked; spawn can still proceed.
            let _ = err;
            Ok(pkg)
        }
        Err(err) => Err(err),
    }
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
    run_pip_with_progress(python, args, root, None)
}

pub fn run_pip_with_progress(
    python: &Path,
    args: &[&str],
    root: &Path,
    progress: Option<(&AppHandle, &str)>,
) -> Result<String, String> {
    let cache = user_cache_dir(root);
    let mut cmd = Command::new(python);
    cmd.arg("-m").arg("pip");
    for a in args {
        cmd.arg(a);
    }
    cmd.env("HF_HOME", cache.join("huggingface"))
        .env("TORCH_HOME", cache.join("torch"))
        .env("PIP_DISABLE_PIP_VERSION_CHECK", "1")
        .env("PYTHONUNBUFFERED", "1")
        .env("PIP_PROGRESS_BAR", "on")
        .current_dir(root);

    let output = run_command_streaming(cmd, Duration::from_secs(20 * 60), |line| {
        if let Some((app, extra_id)) = progress {
            emit_install_progress(
                app,
                extra_id,
                "log",
                Some(line),
                parse_pip_progress_bytes(line),
            );
        }
    })?;
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
        "vocal-ml" => Some("vocal-ml"),
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
    let progress = Some((app, extra_id));
    let mut out = match run_pip_with_progress(&py, &["install", "-e", &req], &root, progress) {
        Ok(log) => log,
        Err(err) if extra_id == "generate" => {
            let fallback = generate_windows_fallback(&py, &root, progress)?;
            format!("{err}\n{fallback}")
        }
        Err(err) if extra_id == "vocal-rvc" => {
            let fallback = vocal_rvc_windows_fallback(&py, &root, progress)?;
            format!("{err}\n{fallback}")
        }
        Err(err) => return Err(err),
    };
    if extra_id == "generate" {
        if let Ok(ac) = run_pip_with_progress(
            &py,
            &["install", "audiocraft>=1.3", "--no-deps"],
            &root,
            progress,
        ) {
            out = format!("{out}\n{ac}");
        }
    }
    let _ = fs::write(
        root.join("state.json"),
        format!(
            "{{\n  \"preferUserVenv\": true,\n  \"packageVersion\": \"{PACKAGE_VERSION}\",\n  \"lastExtra\": \"{extra_id}\"\n}}\n"
        ),
    );
    Ok(out)
}

const GENERATE_FALLBACK_DEPS: &[&str] = &[
    "torchaudio",
    "hydra-core",
    "hydra-colorlog",
    "flashy",
    "sentencepiece",
    "encodec",
    "omegaconf",
    "num2words",
    "protobuf",
    "torchmetrics",
    "spacy",
];

const VOCAL_RVC_FALLBACK_DEPS: &[&str] = &[
    "faiss-cpu",
    "loguru",
    "ffmpeg-python",
    "python-multipart",
    "praat-parselmouth>=0.4.2",
    "pyworld",
    "torchcrepe",
    "bitarray",
    "sacrebleu",
    "cython",
];

fn generate_windows_fallback(
    python: &Path,
    root: &Path,
    progress: Option<(&AppHandle, &str)>,
) -> Result<String, String> {
    let mut log = run_pip_with_progress(python, &["install", "--only-binary=:all:", "av"], root, progress)?;
    let mut deps = vec!["install"];
    deps.extend_from_slice(GENERATE_FALLBACK_DEPS);
    log.push_str(&run_pip_with_progress(python, &deps, root, progress)?);
    log.push_str(&run_pip_with_progress(
        python,
        &["install", "audiocraft>=1.3.0", "--no-deps"],
        root,
        progress,
    )?);
    Ok(log)
}

fn vocal_rvc_windows_fallback(
    python: &Path,
    root: &Path,
    progress: Option<(&AppHandle, &str)>,
) -> Result<String, String> {
    let mut log = run_pip_with_progress(python, &["install", "rvc-python", "--no-deps"], root, progress)?;
    log.push_str(&run_pip_with_progress(
        python,
        &["install", "fairseq==0.12.2", "--no-deps"],
        root,
        progress,
    )?);
    let mut deps = vec!["install"];
    deps.extend_from_slice(VOCAL_RVC_FALLBACK_DEPS);
    log.push_str(&run_pip_with_progress(python, &deps, root, progress)?);
    Ok(log)
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
        assert_eq!(pip_extra_spec("vocal-ml"), Some("vocal-ml"));
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

    #[test]
    fn user_sidecar_stamp_matches_package_from_version_txt_and_state() {
        let stamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("aimc-sidecar-stamp-{stamp}"));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        assert!(!user_sidecar_stamp_matches_package(&root));
        fs::write(root.join("version.txt"), "0.0.0-stale\n").unwrap();
        assert!(!user_sidecar_stamp_matches_package(&root));
        fs::write(root.join("version.txt"), format!("{PACKAGE_VERSION}\n")).unwrap();
        assert!(user_sidecar_stamp_matches_package(&root));
        fs::remove_file(root.join("version.txt")).unwrap();
        fs::write(
            root.join("state.json"),
            format!(r#"{{"preferUserVenv":true,"packageVersion":"{PACKAGE_VERSION}"}}"#),
        )
        .unwrap();
        assert_eq!(
            user_sidecar_version_stamp(&root).as_deref(),
            Some(PACKAGE_VERSION)
        );
        assert!(user_sidecar_stamp_matches_package(&root));
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn windows_py_launcher_flag_is_dash_version() {
        // Guard against regressing to `py - 3.10` (two argv tokens → default REPL).
        let flag = py_launcher_version_flag("3.10");
        assert_eq!(flag, "-3.10");
        assert!(!flag.contains(' '));
    }

    #[test]
    fn overlay_copy_does_not_wipe_destination() {
        let stamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("aimc-pkg-overlay-{stamp}"));
        let src = root.join("src");
        let dst = root.join("dst");
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(src.join("ai_sidecar")).unwrap();
        fs::write(src.join("pyproject.toml"), "[project]\nname='x'\n").unwrap();
        fs::write(src.join("ai_sidecar/main.py"), "print(1)\n").unwrap();
        fs::create_dir_all(dst.join("ai_sidecar")).unwrap();
        fs::write(dst.join("keep-me.txt"), "alive\n").unwrap();
        copy_dir_recursive(&src, &dst).unwrap();
        assert!(dst.join("keep-me.txt").is_file());
        assert!(package_source_ok(&dst));
        let _ = fs::remove_dir_all(&root);
    }
}
