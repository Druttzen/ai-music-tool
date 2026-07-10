"""Tests for sonic signature extraction."""

from __future__ import annotations

import io

import numpy as np
import pytest
import soundfile as sf

from ai_sidecar.sonic_signature import extract_sonic_signature


def _sine_wav_bytes(freq: float = 440.0, duration: float = 2.0, sr: int = 22050) -> bytes:
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)
    y = 0.3 * np.sin(2 * np.pi * freq * t)
    buf = io.BytesIO()
    sf.write(buf, y, sr, format="WAV")
    return buf.getvalue()


def test_extract_sonic_signature_returns_core_fields():
    raw = _sine_wav_bytes()
    sig = extract_sonic_signature(raw)
    assert sig["duration_sec"] > 1.5
    assert sig["tempo_bpm"] > 0
    assert sig["key_estimate"]
    assert 0 <= sig["key_confidence"] <= 1
    assert sig["provider"] == "librosa"
    assert isinstance(sig["chord_progression"], list)
    assert isinstance(sig["timeline_segments"], list)


def test_extract_sonic_signature_empty_raises():
    with pytest.raises(Exception):
        extract_sonic_signature(b"")


def test_sonic_signature_endpoint():
    from fastapi.testclient import TestClient

    from ai_sidecar.main import app

    client = TestClient(app)
    raw = _sine_wav_bytes()
    res = client.post(
        "/sonic-signature",
        files={"file": ("test.wav", raw, "audio/wav")},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["tempo_bpm"] > 0
    assert "chord_progression" in data
