"""Selected model setup uses the same internal cache as default installation."""
import pytest
from ai_sidecar import model_readiness, musicgen


@pytest.mark.parametrize("preset", sorted(model_readiness.MUSICGEN_PRESETS))
def test_prepares_selected_preset_only(monkeypatch, preset):
    calls = []
    monkeypatch.setenv("HF_HUB_OFFLINE", "1")
    monkeypatch.setenv("TRANSFORMERS_OFFLINE", "1")
    monkeypatch.setattr(musicgen, "_get_model", lambda device, model: calls.append((device, model)))
    monkeypatch.setattr(model_readiness, "hf_model_cached", lambda *args, **kwargs: True)
    monkeypatch.setattr(model_readiness, "readiness", lambda *args: {"offlineReady": True})
    model_readiness.provision("generate", musicgen_model=preset)
    assert calls == [("cpu", f"facebook/musicgen-{preset}")]


def test_rejects_unlisted_model_before_loading(monkeypatch):
    monkeypatch.setenv("HF_HUB_OFFLINE", "1")
    monkeypatch.setenv("TRANSFORMERS_OFFLINE", "1")
    monkeypatch.setattr(musicgen, "_get_model", lambda *args: pytest.fail("Must not load an unlisted model"))
    with pytest.raises(ValueError, match="Unknown MusicGen"):
        model_readiness.provision("generate", musicgen_model="../../foreign-model")


def test_fails_setup_when_selected_weights_are_missing(monkeypatch):
    monkeypatch.setenv("HF_HUB_OFFLINE", "1")
    monkeypatch.setenv("TRANSFORMERS_OFFLINE", "1")
    monkeypatch.setattr(musicgen, "_get_model", lambda *args: None)
    monkeypatch.setattr(model_readiness, "hf_model_cached", lambda *args, **kwargs: False)
    with pytest.raises(RuntimeError, match="Model setup incomplete"):
        model_readiness.provision("generate", musicgen_model="medium")
