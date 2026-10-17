from types import SimpleNamespace

import pytest

from ai_sidecar import managed_tools as tools, rvc_runtime


def test_rvc_isolated_environment_and_manifest_require_base_models(monkeypatch, tmp_path):
    monkeypatch.setenv("STUDIO_DATA_DIR", str(tmp_path))
    assert tools.runtime_prefix("vocal-rvc").is_relative_to(tmp_path / "addons/vocal-rvc")
    assert "python=3.10" in tools.SPECS["vocal-rvc"]
    assert tools.tool_env("vocal-rvc")["READTHEDOCS"] == "1"
    assert any(path.name == "hubert_base.pt" for path in tools.required_files("vocal-rvc"))


def test_managed_command_failure_preserves_actual_dependency_error(monkeypatch, tmp_path):
    monkeypatch.setenv("STUDIO_DATA_DIR", str(tmp_path))
    monkeypatch.setattr(tools.subprocess, "run", lambda *a, **k: SimpleNamespace(returncode=1, stdout="", stderr="missing dependency"))
    with pytest.raises(RuntimeError, match="missing dependency"):
        tools.run(["python", "--version"], tool="vocal-rvc")


def test_rvc_bridge_preserves_paths_pitch_and_owned_environment(monkeypatch, tmp_path):
    monkeypatch.setenv("STUDIO_DATA_DIR", str(tmp_path))
    calls = []
    def run(args, **kwargs):
        calls.append((args, kwargs))
        return SimpleNamespace(returncode=0)
    monkeypatch.setattr(rvc_runtime.subprocess, "run", run)
    rvc_runtime.convert("input file.wav", "output file.wav", "voice.pth", "voice.index", -2)
    args, kwargs = calls[0]
    assert args[0] == str(tools.mamba_path()) and "rvc_worker.py" in " ".join(args)
    assert args[args.index("--input") + 1] == "input file.wav"
    assert args[args.index("--pitch") + 1] == "-2"
    assert str(kwargs["cwd"]).startswith(str(tmp_path))
    assert kwargs["timeout"] == 900
