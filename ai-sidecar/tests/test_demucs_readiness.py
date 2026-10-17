import importlib.machinery
import sys
from types import ModuleType

import pytest

from ai_sidecar.model_readiness import demucs_cached


@pytest.mark.parametrize("with_ref", [True, False])
def test_demucs_41_hf_cache_is_ready_without_legacy_torch_checkpoint(tmp_path, monkeypatch, with_ref):
    monkeypatch.setenv("HF_HUB_CACHE", str(tmp_path / "hf"))
    monkeypatch.setenv("HF_HOME", str(tmp_path / "other"))
    monkeypatch.setenv("TORCH_HOME", str(tmp_path / "torch"))
    repo = tmp_path / "hf/models--adefossez--HTDemucs"
    snapshot = repo / "snapshots/revision"
    snapshot.mkdir(parents=True)
    (snapshot / "htdemucs.yaml").write_text("models: ['955717e8']\n")
    if with_ref:
        (repo / "refs").mkdir()
        (repo / "refs/main").write_text("revision")
    assert not demucs_cached()
    (snapshot / "955717e8.safetensors").write_bytes(b"checkpoint")
    assert demucs_cached()
    (snapshot / "955717e8.safetensors").write_bytes(b"")
    assert not demucs_cached()


def test_legacy_demucs_checkpoint_remains_supported(tmp_path, monkeypatch):
    monkeypatch.setenv("HF_HUB_CACHE", str(tmp_path / "hf"))
    monkeypatch.setenv("HF_HOME", str(tmp_path / "hf"))
    monkeypatch.setenv("TORCH_HOME", str(tmp_path / "torch"))
    package = tmp_path / "demucs"
    (package / "remote").mkdir(parents=True)
    (package / "remote/htdemucs.yaml").write_text("models: ['955717e8']\n")
    fake = ModuleType("demucs")
    fake.__spec__ = importlib.machinery.ModuleSpec("demucs", None, origin=str(package / "__init__.py"))
    monkeypatch.setitem(sys.modules, "demucs", fake)
    checkpoint = tmp_path / "torch/hub/checkpoints/955717e8-hash.th"
    checkpoint.parent.mkdir(parents=True)
    checkpoint.write_bytes(b"checkpoint")
    assert demucs_cached()


def test_flux_install_downloads_diffusers_components_without_duplicate_original_weights(monkeypatch):
    from ai_sidecar import model_readiness
    import types
    calls = []
    fake = types.ModuleType("huggingface_hub")
    fake.snapshot_download = lambda name, **kwargs: calls.append((name, kwargs))
    monkeypatch.setitem(sys.modules, "huggingface_hub", fake)
    monkeypatch.setattr(model_readiness, "readiness", lambda cap: {"models": {"black-forest-labs/FLUX.1-schnell": False}, "offlineReady": True})
    model_readiness.provision("cover")
    patterns = calls[0][1]["allow_patterns"]
    assert "transformer/*" in patterns and "vae/*" in patterns
    assert "ae.safetensors" not in patterns and "*" not in patterns
