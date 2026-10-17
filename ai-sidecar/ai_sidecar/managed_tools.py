"""Install native tools in Studio-owned environments, without global installers.

Micromamba is pinned and SHA-256 verified. Its resolver verifies conda-forge
package hashes; independent prefixes avoid changing the shared AI environment.
"""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import platform
import shutil
import subprocess
import sys
import tempfile
import urllib.request
import zipfile

TOOL_IDS = ("mfa", "diffsinger", "java", "ffmpeg", "vocal-rvc")
OWNER = "com.djmad.aimusiccreator.studio"
MAMBA_VERSION = "2.9.0-0"
MAMBA_HASHES = {
    "win-64": "a6d804394b2418991c4e29562853eaace2f2ce9d9da661a98e74e02e8dbb44b0",
    "osx-64": "1e71054bb3ac9a076e21f7ec48acfef536f9b3f1408f371a942784bf5ef83d8a",
    "osx-arm64": "ec2a072f028e1a7cf20f3e2e74d5a8127cf5a5f27636375b5359811565f4e5be",
    "linux-64": "366cd9cd8be14df1ab8ed50352a82111082a36686b2d389fdb79a92c3fafb3e3",
}
DS_COMMIT = "323a5693245b827caba0ab1a7371fe5ca885b061"  # upstream v2.5.1
DS_SHA256 = "2a4b6761076608568748b29c10c1b7c0d8ca8513a0e13c156240bf755922989d"
MFA_MODELS = {
    "acoustic": ("english_mfa.zip", "2c08bd4f82c3943dd57ac09aeac99dbce17a1e1bfe9fd932c8d95cd13d971068"),
    "dictionary": ("english_mfa.dict", "975bf9c7791535c5aec57995e0bd2b77eb7ca364d1d974c2134e07bb0f16b079"),
}
SPECS = {
    "mfa": ["python=3.11", "montreal-forced-aligner=3.3.9"],
    "diffsinger": ["python=3.10", "pip", "numpy=1.26", "pyworld=0.3.4", "ffmpeg=7.1"],
    "java": ["openjdk=17"],
    "ffmpeg": ["ffmpeg=7.1"],
    "vocal-rvc": ["python=3.10", "pip=24.0", "numpy=1.23.5", "pyworld=0.3.4"],
}


def platform_id(system: str | None = None, machine: str | None = None) -> str:
    system = system or platform.system()
    machine = (machine or platform.machine()).lower()
    if system == "Darwin" and machine in {"arm64", "aarch64"}:
        return "osx-arm64"
    if machine in {"amd64", "x86_64"} and system in {"Windows", "Darwin", "Linux"}:
        return {"Windows": "win-64", "Darwin": "osx-64", "Linux": "linux-64"}[system]
    raise RuntimeError(f"Managed tools do not support {system}/{machine}")


def data_root() -> Path:
    raw = os.environ.get("STUDIO_DATA_DIR", "").strip()
    if not raw or not Path(raw).is_absolute():
        raise RuntimeError("An absolute Studio data folder is required")
    return Path(raw).resolve()


def owned_path(*parts: str) -> Path:
    data = data_root()
    target = data.joinpath(*parts)
    if not target.resolve().is_relative_to(data) or target.resolve() != target:
        raise RuntimeError("Managed tool paths cannot be redirected outside Studio")
    return target


def tool_root(tool: str) -> Path:
    if tool not in TOOL_IDS:
        raise ValueError(f"Unknown managed tool: {tool}")
    return owned_path("addons" if tool in {"diffsinger", "vocal-rvc"} else "tools", tool)


def runtime_prefix(tool: str) -> Path:
    root = tool_root(tool)
    return owned_path(*root.relative_to(data_root()).parts, "runtime")


def mamba_path() -> Path:
    return owned_path("tools", "micromamba", "micromamba.exe" if os.name == "nt" else "micromamba")


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def download(url: str, target: Path, sha256: str) -> None:
    if not url.startswith("https://") or len(sha256) != 64:
        raise ValueError("Verified HTTPS asset required")
    if target.is_file() and _sha256(target) == sha256:
        return
    target.parent.mkdir(parents=True, exist_ok=True)
    partial = target.with_suffix(target.suffix + ".partial")
    try:
        request = urllib.request.Request(url, headers={"User-Agent": "AI-Music-Creator-Studio"})
        with urllib.request.urlopen(request, timeout=120) as response, partial.open("wb") as dest:
            shutil.copyfileobj(response, dest)
        if _sha256(partial) != sha256:
            raise RuntimeError(f"Checksum mismatch for {target.name}")
        os.replace(partial, target)
    finally:
        partial.unlink(missing_ok=True)


def tool_env(tool: str | None = None) -> dict[str, str]:
    env = os.environ.copy()
    data = data_root()
    cache = owned_path("tools", ".cache")
    tmp = owned_path("sidecar", "tmp")
    cache.mkdir(parents=True, exist_ok=True)
    tmp.mkdir(parents=True, exist_ok=True)
    # Ignore personal conda configuration; never install or cache in the home folder.
    for key in list(env):
        if key.startswith(("CONDA_", "MAMBA_", "PIP_")) or key in {"PYTHONHOME", "PYTHONPATH", "PYTHONUSERBASE"}:
            env.pop(key, None)
    env.update({"MAMBA_ROOT_PREFIX": str(owned_path("tools", "micromamba", "root")),
                "CONDA_PKGS_DIRS": str(cache / "conda"), "PIP_CACHE_DIR": str(cache / "pip"),
                "MFA_ROOT_DIR": str(owned_path("tools", "mfa", "models")),
                "XDG_CACHE_HOME": str(cache), "HF_HOME": str(cache / "huggingface"),
                "TORCH_HOME": str(cache / "torch"), "PIP_CONFIG_FILE": os.devnull,
                "TEMP": str(tmp), "TMP": str(tmp),
                "TMPDIR": str(tmp), "PYTHONNOUSERSITE": "1", "PYTHONUTF8": "1",
                "PYTHONUNBUFFERED": "1", "STUDIO_DATA_DIR": str(data)})
    if tool:
        prefix = runtime_prefix(tool)
        bins = ([prefix, prefix / "Scripts", prefix / "Library" / "bin"] if os.name == "nt"
                else [prefix / "bin"])
        env["PATH"] = os.pathsep.join(str(path) for path in bins) + os.pathsep + env.get("PATH", "")
        if tool == "vocal-rvc":
            # Fairseq's upstream switch disables training-only C++ extensions.
            # HuBERT inference does not need a compiler or Python development SDK.
            env["READTHEDOCS"] = "1"
    return env


def run(args: list[str], *, tool: str | None = None, cwd: Path | None = None) -> None:
    print("Running: " + " ".join(str(arg) for arg in args), flush=True)
    result = subprocess.run([str(arg) for arg in args], cwd=cwd or data_root(), env=tool_env(tool),
                            capture_output=True, text=True, encoding="utf-8", errors="replace",
                            timeout=45 * 60, creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
    output = result.stdout + result.stderr
    if output:
        print(output, flush=True)
    if result.returncode:
        raise RuntimeError(f"Managed {tool or 'tool'} command failed: {output[-4000:]}")


def ensure_mamba() -> Path:
    target = mamba_path()
    target_id = platform_id()
    filename = f"micromamba-{target_id}" + (".exe" if target_id == "win-64" else "")
    download(f"https://github.com/mamba-org/micromamba-releases/releases/download/{MAMBA_VERSION}/{filename}",
             target, MAMBA_HASHES[target_id])
    if os.name != "nt":
        target.chmod(0o755)
    run([target, "--version"])
    return target


def command(tool: str, *args: str) -> list[str]:
    if tool == "java" and args and args[0] == "java":
        args = (str(java_home() / "bin" / ("java.exe" if os.name == "nt" else "java")), *args[1:])
    return [str(mamba_path()), "--no-rc", "run", "-p", str(runtime_prefix(tool)), *map(str, args)]


def java_home() -> Path:
    # conda-forge's Unix JDK lives in lib/jvm; macOS packages do not
    # necessarily provide the bin/java symlink available on Linux.
    return runtime_prefix("java") / ("Library" if os.name == "nt" else "lib/jvm")


def required_files(tool: str) -> list[Path]:
    prefix = runtime_prefix(tool)
    bin_dir = prefix / ("Library/bin" if os.name == "nt" else "bin")
    names = {"java": [java_home() / "bin" / ("java.exe" if os.name == "nt" else "java")],
             "ffmpeg": [bin_dir / (name + (".exe" if os.name == "nt" else "")) for name in ("ffmpeg", "ffprobe")],
             "mfa": [prefix / ("Scripts/mfa.exe" if os.name == "nt" else "bin/mfa")],
             "diffsinger": [prefix / ("python.exe" if os.name == "nt" else "bin/python"),
                            tool_root(tool) / "source/scripts/infer.py"],
             "vocal-rvc": [prefix / ("python.exe" if os.name == "nt" else "bin/python"),
                           *[prefix / ("Lib/site-packages" if os.name == "nt" else "lib/python3.10/site-packages") / "rvc_python" / name
                             for name in ("infer.py", "base_model/hubert_base.pt", "base_model/rmvpe.pt", "base_model/rmvpe.onnx")]]}
    return [mamba_path(), prefix / "conda-meta/history", *names[tool]]


def installed(tool: str) -> bool:
    try:
        manifest = json.loads((tool_root(tool) / "tool.json").read_text(encoding="utf-8"))
        return (manifest.get("owner") == OWNER and manifest.get("id") == tool
                and all(path.is_file() for path in required_files(tool)))
    except (OSError, ValueError, RuntimeError):
        return False


def deactivate(tool: str) -> None:
    (tool_root(tool) / "tool.json").unlink(missing_ok=True)


def extract_ds(archive: Path, source: Path) -> None:
    if _sha256(archive) != DS_SHA256:
        raise RuntimeError("DiffSinger source checksum mismatch")
    with zipfile.ZipFile(archive) as zipped:
        for info in zipped.infolist():
            parts = PurePosixPath(info.filename).parts
            if len(parts) < 2:
                continue
            relative = parts[1:]
            target = source.joinpath(*relative)
            if (".." in relative or "\\" in info.filename or ":" in info.filename
                    or not target.resolve().is_relative_to(source.resolve())
                    or (info.external_attr >> 16) & 0o170000 == 0o120000):
                raise RuntimeError("Unsafe DiffSinger source archive")
            if info.is_dir():
                target.mkdir(parents=True, exist_ok=True)
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                with zipped.open(info) as src, target.open("wb") as dst:
                    shutil.copyfileobj(src, dst)


def install(tool: str) -> None:
    root = tool_root(tool)
    root.mkdir(parents=True, exist_ok=True)
    # A failed refresh must not retain an old successful-activation marker.
    deactivate(tool)
    mamba = ensure_mamba()
    prefix = runtime_prefix(tool)
    verb = "install" if (prefix / "conda-meta" / "history").is_file() else "create"
    run([mamba, "--no-rc", verb, "-y", "-p", prefix, "--override-channels", "-c", "conda-forge",
         "--strict-channel-priority", *SPECS[tool]])
    # A global command on PATH must not make a broken local install pass probes.
    for path in required_files(tool):
        if tool == "vocal-rvc" and "rvc_python" in path.parts:
            continue  # Engine and base encoders are prepared below.
        if tool in {"diffsinger", "vocal-rvc"} and path.name == "infer.py":
            continue  # Source is extracted below.
        if not path.is_file():
            raise RuntimeError(f"Managed {tool} installation is missing {path}")
    if tool == "vocal-rvc":
        from .rvc_runtime import install_runtime
        install_runtime()
    elif tool == "mfa":
        run(command(tool, "mfa", "version"), tool=tool)
        # MFA's discovery command scans GitHub releases and can exhaust the
        # anonymous API quota. Pinned public assets need neither discovery nor
        # a personal access token, and the hashes also verify cached models.
        for kind, (filename, digest) in MFA_MODELS.items():
            download(f"https://github.com/MontrealCorpusTools/mfa-models/releases/download/{kind}-english_mfa-v3.1.0/{filename}",
                     root / "models/pretrained_models" / kind / filename, digest)
        for kind in ("acoustic", "dictionary"):
            run(command(tool, "mfa", "model", "inspect", kind, "english_mfa"), tool=tool)
    elif tool == "diffsinger":
        archive = root / "source.zip"
        source = root / "source"
        download(f"https://codeload.github.com/openvpi/DiffSinger/zip/{DS_COMMIT}", archive, DS_SHA256)
        extract_ds(archive, source)
        (source / "checkpoints").mkdir(exist_ok=True)
        voice = root / "voice.json"
        if not voice.exists():
            voice.write_text(json.dumps({"acoustic_exp": "", "variance_exp": ""}, indent=2), encoding="utf-8")
        torch_args = ["torch==2.2.2"]
        if platform.system() != "Darwin":
            torch_args += ["--index-url", "https://download.pytorch.org/whl/cpu"]
        run(command(tool, "python", "-m", "pip", "install", "--only-binary=:all:", *torch_args), tool=tool)
        # Upstream's broad pytorch-lightning dependency can otherwise upgrade
        # torch again; librosa 0.9 also still imports setuptools.pkg_resources.
        constraints = root / "compatibility-constraints.txt"
        constraints.write_text(
            "torch==2.2.2\nnumpy==1.26.4\npytorch-lightning==2.3.3\ntorchmetrics==1.4.3\nsetuptools==75.8.2\n"
            # Newer Numba/llvmlite releases dropped Intel Mac wheels. Keep
            # installation independent of a system LLVM compiler there.
            "numba==0.62.1; sys_platform == 'darwin' and platform_machine == 'x86_64'\n"
            "libcst==1.8.6; sys_platform == 'darwin' and platform_machine == 'x86_64'\n",
            encoding="utf-8")
        run(command(tool, "python", "-m", "pip", "install", "--only-binary=:all:", "setuptools==75.8.2", "-c", str(constraints),
                    "-r", str(source / "requirements.txt")), tool=tool)
        run(command(tool, "python", "-c", "import torch, librosa, lightning, pyworld, parselmouth; from inference.ds_acoustic import DiffSingerAcousticInfer"), tool=tool, cwd=source)
        run(command(tool, "python", "scripts/infer.py", "acoustic", "--help"), tool=tool, cwd=source)
        run(command(tool, "python", "scripts/infer.py", "variance", "--help"), tool=tool, cwd=source)
    else:
        run(command(tool, tool, "-version"), tool=tool)
        if tool == "ffmpeg":
            run(command(tool, "ffprobe", "-version"), tool=tool)
    manifest = {"owner": OWNER, "id": tool, "platform": platform_id(), "specs": SPECS[tool],
                "sourceCommit": DS_COMMIT if tool == "diffsinger" else None}
    if not all(path.is_file() for path in required_files(tool)):
        raise RuntimeError(f"Managed {tool} verification failed: required files are missing")
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=root, delete=False) as out:
        json.dump(manifest, out)
        name = out.name
    os.replace(name, root / "tool.json")
    print(f"Installed {tool} inside {root}", flush=True)


def configure() -> None:
    """Reconnect managed engines on every sidecar start, without editing global env."""
    for tool in ("ffmpeg", "java"):
        if installed(tool):
            prefix = runtime_prefix(tool)
            bins = ([java_home() / "bin"] if tool == "java" else
                    [prefix / "Library/bin", prefix / "Scripts"] if os.name == "nt" else [prefix / "bin"])
            os.environ["PATH"] = os.pathsep.join(map(str, bins)) + os.pathsep + os.environ.get("PATH", "")
            if tool == "java":
                os.environ["JAVA_HOME"] = str(java_home())
    if installed("mfa"):
        os.environ.update({"MFA_ROOT_DIR": str(tool_root("mfa") / "models"),
                           "AIMC_MFA_MODEL": "english_mfa", "AIMC_MFA_DICT": "english_mfa"})
    if installed("diffsinger"):
        os.environ["AIMC_DIFFSINGER_ROOT"] = str(tool_root("diffsinger") / "source")
        # Never run DiffSinger in the shared sidecar interpreter.
        os.environ["AIMC_DIFFSINGER_PYTHON"] = str(runtime_prefix("diffsinger") / ("python.exe" if os.name == "nt" else "bin/python"))
        voice = tool_root("diffsinger") / "voice.json"
        if voice.is_file():
            try:
                values = json.loads(voice.read_text(encoding="utf-8-sig"))
                import re
                for field, key in (("acoustic_exp", "AIMC_DIFFSINGER_ACOUSTIC_EXP"), ("variance_exp", "AIMC_DIFFSINGER_VAR_EXP")):
                    value = values.get(field, "")
                    if isinstance(value, str) and re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]*", value):
                        os.environ[key] = value
            except (OSError, ValueError, AttributeError):
                print("DiffSinger voice.json needs a valid acoustic_exp and variance_exp", flush=True)


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=("install", "deactivate"))
    parser.add_argument("tool", choices=TOOL_IDS)
    args = parser.parse_args()
    (install if args.action == "install" else deactivate)(args.tool)
