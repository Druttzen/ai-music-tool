"""Vocal Embed placement-mix synthesis."""

import io
import json

import numpy as np
import pytest
from fastapi.testclient import TestClient

from ai_sidecar.main import app
from ai_sidecar.vocal_ml import ml_vocal_stack_available
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


def _ready_plan(mode="guide-vocal-conversion"):
    return {
        "kind": "vocal_embed_plan",
        "version": 1,
        "createdAt": "2026-07-09T00:00:00.000Z",
        "plan": {
            "stage": "ready",
            "sidecarMode": mode,
            "voiceStyle": "warm baritone narrator",
            "lyrics": "[Verse]\nOne two three",
            "warnings": [],
            "sections": [
                {
                    "name": "Verse",
                    "start": 0.0,
                    "end": 0.8,
                    "lineCount": 2,
                    "text": "[Verse]\nOne two three",
                }
            ],
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
    expected_engine = "guide-conversion-v1" if ml_vocal_stack_available() else "placement-mix-v1"
    assert meta["engine"] == expected_engine
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


@pytest.mark.skipif(not synthesis_stack_available(), reason="librosa/soundfile not installed")
def test_vocal_embed_synthesize_requires_guide_without_ml():
    if ml_vocal_stack_available():
        pytest.skip("vocal DSP installed — lyrics-only path is allowed")
    inst = _tone_wav()
    res = client.post(
        "/vocal-embed/synthesize",
        data={"plan_json": json.dumps(_ready_plan())},
        files={"instrumental": ("inst.wav", inst, "audio/wav")},
    )
    assert res.status_code == 422


@pytest.mark.skipif(not ml_vocal_stack_available(), reason="vocal DSP extra not installed")
def test_vocal_embed_synthesize_lyrics_without_guide():
    inst = _tone_wav(duration_sec=2.0, freq=220.0)
    res = client.post(
        "/vocal-embed/synthesize",
        data={"plan_json": json.dumps(_ready_plan("lyrics-to-vocal-synthesis"))},
        files={"instrumental": ("inst.wav", inst, "audio/wav")},
    )
    assert res.status_code == 200
    assert res.headers.get("x-vocal-embed-engine") == "lyrics-synth-v1"
