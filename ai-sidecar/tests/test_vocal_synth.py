"""Vocal Embed placement-mix synthesis."""

import io
import json

import numpy as np
import pytest
from fastapi.testclient import TestClient

from ai_sidecar.main import app
from ai_sidecar.vocal_synth import synthesis_stack_available, synthesize_vocal_embed_mix

client = TestClient(app)


def _tone_wav(duration_sec: float = 1.0, freq: float = 440.0, sample_rate: int = 44100) -> bytes:
    import soundfile as sf

    t = np.linspace(0, duration_sec, int(sample_rate * duration_sec), endpoint=False)
    mono = (0.25 * np.sin(2 * np.pi * freq * t)).astype(np.float32)
    stereo = np.stack([mono, mono], axis=1)
    buf = io.BytesIO()
    sf.write(buf, stereo, sample_rate, subtype="PCM_16", format="WAV")
    return buf.getvalue()


def _ready_plan():
    return {
        "kind": "vocal_embed_plan",
        "version": 1,
        "createdAt": "2026-07-09T00:00:00.000Z",
        "plan": {
            "stage": "ready",
            "sidecarMode": "guide-vocal-conversion",
            "warnings": [],
            "sections": [{"name": "Verse", "start": 0.0, "end": 0.8, "lineCount": 2}],
            "mixPlan": {"instrumentalDuckDb": -4, "vocalHighPassHz": 90},
        },
    }


@pytest.mark.skipif(not synthesis_stack_available(), reason="librosa/soundfile not installed")
def test_synthesize_vocal_embed_mix_unit():
    plan = _ready_plan()["plan"]
    inst = _tone_wav(freq=220.0)
    guide = _tone_wav(freq=880.0)
    wav_bytes, meta = synthesize_vocal_embed_mix(plan, inst, guide)
    assert len(wav_bytes) > 1000
    assert meta["engine"] == "placement-mix-v1"
    assert meta["section_count"] == 1


@pytest.mark.skipif(not synthesis_stack_available(), reason="librosa/soundfile not installed")
def test_vocal_embed_synthesize_endpoint():
    inst = _tone_wav(freq=220.0)
    guide = _tone_wav(freq=880.0)
    res = client.post(
        "/vocal-embed/synthesize",
        data={"plan_json": json.dumps(_ready_plan())},
        files={
            "instrumental": ("inst.wav", inst, "audio/wav"),
            "guide_vocal": ("guide.wav", guide, "audio/wav"),
        },
    )
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("audio/")
    assert len(res.content) > 1000
    assert res.headers.get("x-vocal-embed-engine") == "placement-mix-v1"


@pytest.mark.skipif(not synthesis_stack_available(), reason="librosa/soundfile not installed")
def test_vocal_embed_synthesize_requires_guide():
    inst = _tone_wav()
    res = client.post(
        "/vocal-embed/synthesize",
        data={"plan_json": json.dumps(_ready_plan())},
        files={"instrumental": ("inst.wav", inst, "audio/wav")},
    )
    assert res.status_code == 422
