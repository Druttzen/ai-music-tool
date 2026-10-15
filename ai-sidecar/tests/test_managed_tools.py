import hashlib
import io
import json
from pathlib import Path
import subprocess
import zipfile

import pytest

from ai_sidecar import managed_tools as tools


@pytest.mark.parametrize("system,machine,expected", [
    ("Windows", "AMD64", "win-64"), ("Linux", "x86_64", "linux-64"),
    ("Darwin", "x86_64", "osx-64"), ("Darwin", "arm64", "osx-arm64"),
])
def test_native_assets_match_every_release_target(system, machine, expected):
    assert tools.platform_id(system, machine) == expected
    assert len(tools.MAMBA_HASHES[expected]) == 64


def test_unsupported_target_is_not_silently_mapped_to_x64():
    with pytest.raises(RuntimeError, match="do not support"):
        tools.platform_id("Windows", "ARM64")


def test_install_paths_require_app_owned_absolute_root(monkeypatch, tmp_path):
    monkeypatch.delenv("STUDIO_DATA_DIR", raising=False)
    with pytest.raises(RuntimeError, match="absolute"):
        tools.tool_root("mfa")
    monkeypatch.setenv("STUDIO_DATA_DIR", str(tmp_path))
    assert tools.runtime_prefix("mfa").is_relative_to(tmp_path / "tools")
    assert tools.runtime_prefix("diffsinger").is_relative_to(tmp_path / "addons")
    with pytest.raises(ValueError):
        tools.install("../outside")


def test_download_rejects_wrong_hash_and_preserves_existing_file(monkeypatch, tmp_path):
    target = tmp_path / "asset"
    target.write_bytes(b"previous")
    monkeypatch.setattr(tools.urllib.request, "urlopen", lambda *a, **k: io.BytesIO(b"wrong"))
    with pytest.raises(RuntimeError, match="Checksum"):
        tools.download("https://example.test/asset", target, hashlib.sha256(b"expected").hexdigest())
    assert target.read_bytes() == b"previous"
    assert not target.with_suffix(".partial").exists()


@pytest.mark.parametrize("name", ["repo/../../escaped", "repo/C:/escaped", "repo/..\\..\\escaped"])
def test_source_archive_cannot_escape_managed_folder(monkeypatch, tmp_path, name):
    archive = tmp_path / "source.zip"
    with zipfile.ZipFile(archive, "w") as zipped:
        entry = zipfile.ZipInfo()
        entry.filename = name  # Keep hostile backslashes; Windows ZipInfo normalizes them otherwise.
        zipped.writestr(entry, "bad")
    monkeypatch.setattr(tools, "DS_SHA256", tools._sha256(archive))
    with pytest.raises(RuntimeError, match="Unsafe"):
        tools.extract_ds(archive, tmp_path / "source")
    assert not (tmp_path.parent / "escaped").exists()


def test_global_python_conda_and_pip_destinations_are_not_inherited(monkeypatch, tmp_path):
    monkeypatch.setenv("STUDIO_DATA_DIR", str(tmp_path))
    for key in ("PYTHONPATH", "PYTHONHOME", "CONDA_PREFIX", "PIP_TARGET", "PIP_USER"):
        monkeypatch.setenv(key, "/foreign")
    env = tools.tool_env("mfa")
    assert all(key not in env for key in ("PYTHONPATH", "PYTHONHOME", "CONDA_PREFIX", "PIP_TARGET", "PIP_USER"))
    for key in ("MAMBA_ROOT_PREFIX", "CONDA_PKGS_DIRS", "PIP_CACHE_DIR", "MFA_ROOT_DIR", "TEMP"):
        assert Path(env[key]).is_relative_to(tmp_path)


def test_failed_engine_verification_does_not_activate(monkeypatch, tmp_path):
    monkeypatch.setenv("STUDIO_DATA_DIR", str(tmp_path))
    root = tools.tool_root("java")
    root.mkdir(parents=True)
    (root / "tool.json").write_text(json.dumps({"owner": tools.OWNER, "id": "java"}))
    monkeypatch.setattr(tools, "ensure_mamba", lambda: tmp_path / "mamba")
    monkeypatch.setattr(tools, "required_files", lambda tool: [])
    calls = []
    def run(args, **kwargs):
        calls.append(args)
        if "run" in args:
            raise subprocess.CalledProcessError(1, args)
    monkeypatch.setattr(tools, "run", run)
    with pytest.raises(subprocess.CalledProcessError):
        tools.install("java")
    assert not (root / "tool.json").exists()
    assert "--override-channels" in calls[0] and "--no-rc" in calls[0]


def test_global_command_cannot_activate_a_missing_local_runtime(monkeypatch, tmp_path):
    monkeypatch.setenv("STUDIO_DATA_DIR", str(tmp_path))
    monkeypatch.setattr(tools, "ensure_mamba", lambda: tmp_path / "mamba")
    monkeypatch.setattr(tools, "run", lambda *args, **kwargs: None)
    with pytest.raises(RuntimeError, match="installation is missing"):
        tools.install("ffmpeg")
    assert not tools.installed("ffmpeg")
    assert not (tools.tool_root("ffmpeg") / "tool.json").exists()


def test_marker_does_not_hide_deleted_engine_files(monkeypatch, tmp_path):
    monkeypatch.setenv("STUDIO_DATA_DIR", str(tmp_path))
    root = tools.tool_root("diffsinger")
    root.mkdir(parents=True)
    (root / "tool.json").write_text(json.dumps({"owner": tools.OWNER, "id": "diffsinger"}))
    files = tools.required_files("diffsinger")
    for path in files:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("fixture")
    assert tools.installed("diffsinger")
    (root / "source/scripts/infer.py").unlink()
    assert not tools.installed("diffsinger")


def test_managed_mfa_is_launched_through_its_environment(monkeypatch, tmp_path):
    from ai_sidecar import vocal_align
    import numpy as np
    monkeypatch.setenv("STUDIO_DATA_DIR", str(tmp_path))
    monkeypatch.setattr(tools, "installed", lambda tool: tool == "mfa")
    seen = []
    def invoke(args, **kwargs):
        seen.append((args, kwargs))
    monkeypatch.setattr(vocal_align.subprocess, "run", invoke)
    assert vocal_align.mfa_configured() and vocal_align.mfa_ready()
    vocal_align._align_with_mfa(np.zeros(16000, dtype=np.float32), 16000, "hello", ["hello"])
    assert seen[0][0][:3] == [str(tools.mamba_path()), "--no-rc", "run"]
    assert "align" in seen[0][0]
    assert Path(seen[0][1]["env"]["MFA_ROOT_DIR"]).is_relative_to(tmp_path)


def test_diff_singer_uses_its_own_python_and_remains_unready_without_voice(monkeypatch, tmp_path):
    from ai_sidecar import diffsinger_openvpi as ds
    monkeypatch.setenv("STUDIO_DATA_DIR", str(tmp_path))
    monkeypatch.setattr(tools, "installed", lambda tool: tool == "diffsinger")
    monkeypatch.delenv("AIMC_DIFFSINGER_ACOUSTIC_EXP", raising=False)
    assert ds.openvpi_root() == tools.tool_root("diffsinger") / "source"
    assert not ds.openvpi_ready()
    seen = []
    monkeypatch.setattr(ds.subprocess, "run", lambda args, **kwargs: seen.append((args, kwargs)))
    ds._run_infer("acoustic", tmp_path / "song.ds", tmp_path, "my_voice")
    assert seen[0][0][:5] == tools.command("diffsinger")[:5]
    assert "python" in seen[0][0]
    assert Path(seen[0][1]["env"]["MAMBA_ROOT_PREFIX"]).is_relative_to(tmp_path)


def test_empty_voice_directory_never_means_managed_synthesis_is_ready(monkeypatch, tmp_path):
    from ai_sidecar import diffsinger_openvpi as ds
    monkeypatch.setenv("STUDIO_DATA_DIR", str(tmp_path))
    monkeypatch.setattr(tools, "installed", lambda tool: tool == "diffsinger")
    monkeypatch.setenv("AIMC_DIFFSINGER_ACOUSTIC_EXP", "voice")
    monkeypatch.delenv("AIMC_DIFFSINGER_VAR_EXP", raising=False)
    folder = tools.tool_root("diffsinger") / "source/checkpoints/voice"
    folder.mkdir(parents=True)
    assert not ds.openvpi_ready()
    (folder / "model.ckpt").write_bytes(b"test fixture")
    (folder / "config.yaml").write_text("vocoder_ckpt: /outside/vocoder.ckpt")
    assert not ds.openvpi_ready()
