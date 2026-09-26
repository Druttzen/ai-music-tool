"""Unit tests for MusicGen model selection helpers (no model download)."""

from ai_sidecar.musicgen import (
    model_supports_melody,
    resolve_musicgen_model_id,
)


def test_model_supports_melody_detects_melody_checkpoints():
    assert model_supports_melody("facebook/musicgen-melody-small") is True
    assert model_supports_melody("facebook/musicgen-small") is False


def test_resolve_musicgen_model_id_auto_switches_for_melody(monkeypatch):
    monkeypatch.delenv("AIMC_MUSICGEN_MODEL", raising=False)
    monkeypatch.delenv("AIMC_MUSICGEN_MELODY_MODEL", raising=False)
    assert resolve_musicgen_model_id(wants_melody=False) == "facebook/musicgen-small"
    assert resolve_musicgen_model_id(wants_melody=True) == "facebook/musicgen-melody-small"


def test_resolve_musicgen_model_id_keeps_configured_melody(monkeypatch):
    monkeypatch.setenv("AIMC_MUSICGEN_MODEL", "facebook/musicgen-melody")
    assert resolve_musicgen_model_id(wants_melody=True) == "facebook/musicgen-melody"
    assert resolve_musicgen_model_id(wants_melody=False) == "facebook/musicgen-melody"


def test_generate_music_wav_surfaces_cooperative_cancel_from_token_progress(monkeypatch):
    from contextlib import nullcontext
    from types import SimpleNamespace

    from ai_sidecar.jobs import JobCancellationRequested
    from ai_sidecar.musicgen import generate_music_wav

    previous_callback = lambda *_args: None

    class FakeModel:
        def __init__(self):
            self._progress_callback = previous_callback
            self.progress_enabled = False

        def set_generation_params(self, **_kwargs):
            pass

        def set_custom_progress_callback(self, callback):
            self._progress_callback = callback

        def generate(self, _descriptions, *, progress=False):
            self.progress_enabled = progress
            if progress:
                self._progress_callback(1, 10)
            raise AssertionError("generation should stop at the cancellation callback")

    fake_model = FakeModel()
    monkeypatch.setattr("ai_sidecar.musicgen.generation_available", lambda: True)
    monkeypatch.setattr(
        "ai_sidecar.musicgen._get_model", lambda *_args: (fake_model, "facebook/musicgen-small")
    )
    monkeypatch.setattr("ai_sidecar.idle.touch_activity", lambda: None)
    monkeypatch.setitem(
        __import__("sys").modules,
        "torch",
        SimpleNamespace(inference_mode=nullcontext, manual_seed=lambda _seed: None),
    )

    def stop_generation(_generated, _total):
        raise JobCancellationRequested("cancelled")

    try:
        generate_music_wav("test prompt", on_progress=stop_generation)
    except JobCancellationRequested:
        pass
    else:
        raise AssertionError("cancellation should propagate from the progress callback")

    assert fake_model.progress_enabled is True
    assert fake_model._progress_callback is previous_callback
