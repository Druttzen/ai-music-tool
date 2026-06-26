"""Real Demucs integration (slow; opt-in via SIDECAR_TEST_STEMS=1)."""

import io
import math
import os
import struct
import wave
from io import BytesIO

import pytest
from fastapi.testclient import TestClient

pytestmark = pytest.mark.skipif(
    os.environ.get("SIDECAR_TEST_STEMS") != "1",
    reason="Set SIDECAR_TEST_STEMS=1 and pip install -e 'ai-sidecar[stems]'",
)


def _make_tone_wav(duration_sec=2.0, sample_rate=22050) -> bytes:
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


@pytest.fixture
def client():
    from ai_sidecar.main import _MODEL_CACHE, _STEM_JOBS, app

    _MODEL_CACHE.clear()
    _STEM_JOBS.clear()
    yield TestClient(app)
    _MODEL_CACHE.clear()
    _STEM_JOBS.clear()


@pytest.mark.slow
def test_separate_real_demucs_tone(client):
    wav = _make_tone_wav()
    res = client.post(
        "/separate",
        files={"file": ("tone.wav", BytesIO(wav), "audio/wav")},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["stems"]
    dl = client.get(body["stems"][0]["download_url"])
    assert dl.status_code == 200
    assert len(dl.content) > 1000
