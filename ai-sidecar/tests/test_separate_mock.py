"""Stem separation roundtrip tests with mocked Demucs (no torch install required)."""

import io
import math
import struct
import sys
import wave
from io import BytesIO
from types import ModuleType
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from ai_sidecar.main import _MODEL_CACHE, _STEM_JOBS, app

client = TestClient(app)


def _make_tone_wav(duration_sec=1.0, sample_rate=22050) -> bytes:
    n = int(duration_sec * sample_rate)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        frames = bytearray()
        for i in range(n):
            sample = int(32767 * 0.25 * math.sin(2 * math.pi * 440.0 * i / sample_rate))
            frames.extend(struct.pack("<h", sample))
        wf.writeframes(bytes(frames))
    return buf.getvalue()


@pytest.fixture(autouse=True)
def _clear_stem_state():
    _MODEL_CACHE.clear()
    _STEM_JOBS.clear()
    yield
    _MODEL_CACHE.clear()
    _STEM_JOBS.clear()


def _install_fake_demucs_modules():
    """Inject minimal demucs modules so /separate skips the 503 import guard."""
    fake_model = MagicMock()
    fake_model.samplerate = 44100
    fake_model.audio_channels = 2
    fake_model.sources = ["drums", "bass", "other", "vocals"]

    fake_estimates = __import__("numpy").zeros((4, 2, 44100), dtype=__import__("numpy").float32)

    fake_apply = ModuleType("demucs.apply")
    fake_apply.apply_model = MagicMock(return_value=[fake_estimates])

    fake_audio = ModuleType("demucs.audio")

    class FakeAudioFile:
        def __init__(self, _path):
            pass

        def read(self, **_kwargs):
            import numpy as np

            return np.zeros((2, 44100), dtype=np.float32)

    def fake_save_audio(_source, path, samplerate=44100):
        with wave.open(path, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(samplerate)
            wf.writeframes(struct.pack("<h", 0) * 128)

    fake_audio.AudioFile = FakeAudioFile
    fake_audio.save_audio = fake_save_audio

    fake_pretrained = ModuleType("demucs.pretrained")
    fake_pretrained.get_model = MagicMock(return_value=fake_model)

    fake_demucs = ModuleType("demucs")
    sys.modules["demucs"] = fake_demucs
    sys.modules["demucs.apply"] = fake_apply
    sys.modules["demucs.audio"] = fake_audio
    sys.modules["demucs.pretrained"] = fake_pretrained

    fake_torch = MagicMock()
    fake_torch.no_grad.return_value.__enter__ = MagicMock(return_value=None)
    fake_torch.no_grad.return_value.__exit__ = MagicMock(return_value=False)
    sys.modules["torch"] = fake_torch

    return fake_model, fake_audio


def test_separate_mocked_demucs_roundtrip():
    _install_fake_demucs_modules()
    wav = _make_tone_wav()

    with patch("ai_sidecar.main._load_demucs") as mock_load:
        fake_model = sys.modules["demucs.pretrained"].get_model.return_value
        mock_load.return_value = (fake_model, sys.modules["torch"])

        res = client.post(
            "/separate",
            files={"file": ("tone.wav", BytesIO(wav), "audio/wav")},
        )

    assert res.status_code == 200
    body = res.json()
    assert body["job_id"]
    assert body["sources"] == ["drums", "bass", "other", "vocals"]
    assert len(body["stems"]) == 4

    stem = body["stems"][0]
    dl = client.get(stem["download_url"])
    assert dl.status_code == 200
    assert dl.headers["content-type"].startswith("audio/")


def test_health_reports_stems_available_when_demucs_importable():
    _install_fake_demucs_modules()
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["stems_available"] is True
