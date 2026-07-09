"""Tests for OpenVPI DiffSinger DS builder and configuration."""

import pytest

from ai_sidecar.diffsinger_openvpi import (
    build_ds_segments_from_plan,
    openvpi_configured,
    openvpi_ready,
    synthesize_with_openvpi,
)


def _sample_plan():
    return {
        "bpm": "128",
        "key": "Am",
        "lyrics": "[Verse]\nhello world again\n[Chorus]\nshine bright tonight",
        "sections": [
            {"name": "Verse", "start": 0.0, "end": 4.0, "lineCount": 1, "text": "hello world again"},
            {"name": "Chorus", "start": 4.0, "end": 8.0, "lineCount": 1, "text": "shine bright tonight"},
        ],
    }


def test_build_ds_segments_from_plan():
    segments = build_ds_segments_from_plan(_sample_plan())
    assert len(segments) == 2
    assert segments[0]["offset"] == 0.0
    assert "note_seq" in segments[0]
    assert "note_dur" in segments[0]
    assert "text" in segments[0]
    words = segments[0]["text"].split()
    assert len(words) == len(segments[0]["note_seq"].split())
    assert segments[1]["offset"] == 4.0


def test_build_ds_segments_fallback_without_sections():
    segments = build_ds_segments_from_plan({"lyrics": "one two three", "bpm": "90", "key": "C"})
    assert len(segments) == 1
    assert segments[0]["text"] == "one two three"
    assert len(segments[0]["note_seq"].split()) == 3


def test_openvpi_configured_requires_root_and_acoustic_exp(monkeypatch, tmp_path):
    monkeypatch.delenv("AIMC_DIFFSINGER_ROOT", raising=False)
    monkeypatch.delenv("AIMC_DIFFSINGER_ACOUSTIC_EXP", raising=False)
    assert openvpi_configured() is False

    infer = tmp_path / "scripts"
    infer.mkdir(parents=True)
    (infer / "infer.py").write_text("# stub", encoding="utf-8")
    monkeypatch.setenv("AIMC_DIFFSINGER_ROOT", str(tmp_path))
    assert openvpi_configured() is False

    monkeypatch.setenv("AIMC_DIFFSINGER_ACOUSTIC_EXP", "my_acoustic")
    assert openvpi_configured() is True


def test_openvpi_ready_requires_checkpoints(monkeypatch, tmp_path):
    infer = tmp_path / "scripts"
    infer.mkdir(parents=True)
    (infer / "infer.py").write_text("# stub", encoding="utf-8")
    ckpt = tmp_path / "checkpoints"
    ckpt.mkdir()
    (ckpt / "my_acoustic").mkdir()
    (ckpt / "my_variance").mkdir()

    monkeypatch.setenv("AIMC_DIFFSINGER_ROOT", str(tmp_path))
    monkeypatch.setenv("AIMC_DIFFSINGER_ACOUSTIC_EXP", "my_acoustic")
    monkeypatch.setenv("AIMC_DIFFSINGER_VAR_EXP", "my_variance")
    assert openvpi_ready() is True


def test_synthesize_with_openvpi_requires_variance_for_note_ds(monkeypatch, tmp_path):
    infer = tmp_path / "scripts"
    infer.mkdir(parents=True)
    (infer / "infer.py").write_text("# stub", encoding="utf-8")
    ckpt = tmp_path / "checkpoints"
    ckpt.mkdir()
    (ckpt / "my_acoustic").mkdir()

    monkeypatch.setenv("AIMC_DIFFSINGER_ROOT", str(tmp_path))
    monkeypatch.setenv("AIMC_DIFFSINGER_ACOUSTIC_EXP", "my_acoustic")
    monkeypatch.delenv("AIMC_DIFFSINGER_VAR_EXP", raising=False)

    with pytest.raises(RuntimeError, match="AIMC_DIFFSINGER_VAR_EXP"):
        synthesize_with_openvpi(_sample_plan(), 44100, 44100)


def test_vocal_model_status_includes_openvpi(monkeypatch):
    from ai_sidecar.vocal_ml_models import vocal_model_status

    monkeypatch.delenv("AIMC_DIFFSINGER_ROOT", raising=False)
    status = vocal_model_status()
    assert "diffsinger_openvpi" in status
    assert status["diffsinger_openvpi"]["configured"] is False
