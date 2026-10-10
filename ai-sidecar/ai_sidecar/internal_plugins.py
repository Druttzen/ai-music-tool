"""Provision isolated internal plugin runtimes under Studio's data root."""
from __future__ import annotations
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import urllib.request
import zipfile

ACE_COMMIT = "ca1e85fe9430179831e6bc6be790c332190a3866"
ACE_SHA256 = "108e45dffc7eb62af98d781c4159aa63a2b7a241186734e3e065279da7fc198d"

def plugin_root(plugin: str) -> Path:
    if plugin not in {"acestep", "canvas"}:
        raise ValueError("Unknown internal plugin")
    data = os.environ.get("STUDIO_DATA_DIR", "").strip()
    if not data:
        raise RuntimeError("Studio data root is required for internal plugins")
    root = Path(data).resolve() / "addons" / plugin
    # A redirected plugin must never become an external installation.
    if root.resolve() != root or root.parent.resolve() != root.parent:
        raise RuntimeError("Internal plugin directories cannot be redirected")
    return root

def enforce_internal_integrations() -> None:
    for key in ("AIMC_RVC_API_URL", "AIMC_DIFFSINGER_URL", "AIMC_DIFFSINGER_CMD", "AIMC_DIFFSINGER_ARGV", "AIMC_DIFFSINGER_PYTHON", "AIMC_ACESTEP_HOME", "ACESTEP_HOME"):
        os.environ.pop(key, None)
    data = os.environ.get("STUDIO_DATA_DIR", "").strip()
    mfa = os.environ.get("AIMC_MFA_BIN", "").strip()
    if not data or not mfa or not Path(mfa).resolve().is_relative_to(Path(data).resolve() / "tools"):
        os.environ.pop("AIMC_MFA_BIN", None)
        os.environ.pop("AIMC_MFA_MODEL", None)
        os.environ.pop("AIMC_MFA_DICT", None)
    ds = os.environ.get("AIMC_DIFFSINGER_ROOT", "").strip()
    if ds and (not data or not Path(ds).resolve().is_relative_to(Path(data).resolve() / "addons" / "diffsinger")):
        os.environ.pop("AIMC_DIFFSINGER_ROOT", None)

def active_plugin(plugin: str) -> Path | None:
    try:
        root = plugin_root(plugin)
        manifest = json.loads((root / "plugin.json").read_text(encoding="utf-8"))
        if manifest.get("owner") == "com.djmad.aimusiccreator.studio" and manifest.get("kind") == "sidecar" and manifest.get("id") == plugin:
            return root
    except (OSError, ValueError, RuntimeError):
        pass
    return None

def activate(plugin: str) -> None:
    root = plugin_root(plugin)
    root.mkdir(parents=True, exist_ok=True)
    data = {"owner": "com.djmad.aimusiccreator.studio", "kind": "sidecar", "id": plugin, "sourceCommit": ACE_COMMIT if plugin == "acestep" else "built-in"}
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=root, delete=False) as out:
        json.dump(data, out)
        name = out.name
    os.replace(name, root / "plugin.json")

def extract_source(archive: Path, dest: Path) -> None:
    if hashlib.sha256(archive.read_bytes()).hexdigest() != ACE_SHA256:
        raise RuntimeError("ACE-Step source checksum mismatch")
    with zipfile.ZipFile(archive) as z:
        for info in z.infolist():
            parts = Path(info.filename).parts
            if len(parts) <= 1:
                continue
            path = dest.joinpath(*parts[1:])
            if not path.resolve().is_relative_to(dest.resolve()) or (info.external_attr >> 16) & 0o170000 == 0o120000:
                raise RuntimeError("Unsafe plugin source archive")
            if info.is_dir():
                path.mkdir(parents=True, exist_ok=True)
            else:
                path.parent.mkdir(parents=True, exist_ok=True)
                with z.open(info) as src, path.open("wb") as out:
                    shutil.copyfileobj(src, out)

def run(args: list[str], root: Path, env: dict[str, str]) -> None:
    subprocess.run(args, cwd=root, env=env, check=True, creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)

def install_acestep() -> None:
    root = plugin_root("acestep")
    root.mkdir(parents=True, exist_ok=True)
    source = root / "source"
    archive = root / "source.zip"
    if not archive.is_file():
        url = f"https://codeload.github.com/ACE-Step/ACE-Step-1.5/zip/{ACE_COMMIT}"
        with urllib.request.urlopen(url, timeout=60) as res, archive.with_suffix(".partial").open("wb") as out:
            shutil.copyfileobj(res, out)
        os.replace(archive.with_suffix(".partial"), archive)
    if not (source / ".studio-source-verified").is_file():
        extract_source(archive, source)
        (source / ".studio-source-verified").write_text(ACE_SHA256, encoding="utf-8")
    env = os.environ.copy()
    env["UV_PROJECT_ENVIRONMENT"] = str(root / "runtime")
    env["UV_CACHE_DIR"] = str(root / "cache" / "uv")
    env["UV_PYTHON_INSTALL_DIR"] = str(root / "runtime-python")
    env["ACESTEP_CHECKPOINTS_DIR"] = str(source / "checkpoints")
    # Embedded Studio Python remains the host; uv creates an isolated 3.12 runtime
    # so ACE-Step's pinned dependencies cannot replace MusicGen's dependencies.
    run([sys.executable, "-m", "pip", "install", "uv==0.8.22"], root, env)
    run([sys.executable, "-m", "uv", "sync", "--project", str(source), "--python", sys.executable, "--frozen"], root, env)
    python = root / "runtime" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    run([str(python), "-m", "acestep.model_downloader", "--dir", str(source / "checkpoints")], source, env)
    activate("acestep")

if __name__ == "__main__":
    if sys.argv[1:] == ["install", "acestep"]:
        install_acestep()
    else:
        raise SystemExit("Unsupported internal plugin action")
