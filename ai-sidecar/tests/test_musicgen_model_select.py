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
