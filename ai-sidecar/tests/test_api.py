"""Sidecar API tests (no torch/demucs required for analyze)."""

import io
import math
import struct
import wave
from io import BytesIO

import base64

import pytest
from fastapi.testclient import TestClient

from ai_sidecar.main import app, _stems_available
from ai_sidecar.device import detect_device, select_device
from ai_sidecar.registry import list_capabilities, missing_install_hints
from ai_sidecar.jobs import JOBS, register, JobContext
from ai_sidecar.vision_analyzer import vision_analysis_available

client = TestClient(app)

_MIN_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
)


def _make_tone_wav(duration_sec=3.0, sample_rate=22050, freq_hz=440.0) -> bytes:
    n = int(duration_sec * sample_rate)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        frames = bytearray()
        for i in range(n):
            sample = int(32767 * 0.25 * math.sin(2 * math.pi * freq_hz * i / sample_rate))
            frames.extend(struct.pack("<h", sample))
        wf.writeframes(bytes(frames))
    return buf.getvalue()


def test_health_ok():
    res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert "device" in body
    assert isinstance(body["stems_available"], bool)
    assert isinstance(body["genre_available"], bool)
    assert isinstance(body["vision_available"], bool)
    assert body["vocal_embed_plan_available"] is True
    assert isinstance(body["vocal_synthesis_available"], bool)
    assert isinstance(body["vocal_ml_available"], bool)
    assert isinstance(body["vocal_models_available"], bool)
    assert isinstance(body["vocal_rvc_available"], bool)
    assert isinstance(body["vocal_diffsinger_available"], bool)
    assert isinstance(body["generate_available"], bool)
    assert isinstance(body.get("capabilities"), list)
    assert isinstance(body.get("device_info"), dict)
    assert body["device_info"]["device"] == body["device"]
    assert select_device() in ("cpu", "cuda", "mps")
    assert detect_device().device == body["device"]
    assert list_capabilities()
    assert isinstance(missing_install_hints(), list)


def test_job_manager_register_inline():
    @register("test.echo")
    def _echo(ctx: JobContext):
        ctx.set_progress(0.5, "halfway")
        return {"ok": True, "n": ctx.payload.get("n")}

    job = JOBS.run_inline("test.echo", {"n": 3}, label="echo")
    assert job.status == "done"
    assert job.result == {"ok": True, "n": 3}
    assert JOBS.get(job.job_id) is job


def test_health_allows_local_dev_cors():
    res = client.get("/health", headers={"Origin": "http://localhost:3000"})
    assert res.status_code == 200
    assert res.headers.get("access-control-allow-origin") == "http://localhost:3000"


def test_dev_session_ping():
    res = client.post("/dev-session/ping")
    assert res.status_code == 200
    assert res.json()["ok"] is True


def test_separate_without_stems_extra_returns_503():
    if _stems_available():
        pytest.skip("stems extra installed in this environment")
    res = client.post(
        "/separate",
        files={"file": ("test.wav", BytesIO(b"RIFF"), "audio/wav")},
    )
    assert res.status_code == 503
    assert "stems" in res.json()["detail"].lower() or "unavailable" in res.json()["detail"].lower()


def test_separate_download_missing_job_returns_404():
    res = client.get("/separate/download/missing-token/vocals.wav")
    assert res.status_code == 404


def test_analyze_wav_returns_tempo_and_key():
    wav = _make_tone_wav()
    res = client.post(
        "/analyze",
        files={"file": ("tone.wav", BytesIO(wav), "audio/wav")},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["duration_sec"] > 0
    assert isinstance(body["tempo_bpm"], float)
    assert body["tempo_bpm"] >= 0
    assert body["key_estimate"]
    assert body["spectral_centroid_hz"] > 0
    assert 0 <= body["key_confidence"] <= 1
    assert body["spectral_bandwidth_hz"] >= 0
    assert body["spectral_rolloff_hz"] >= 0
    assert body["onset_strength"] >= 0
    assert body["beat_count"] >= 0
    assert body["beat_density"] >= 0
    assert 0 <= body["percussive_ratio"] <= 1
    assert 0 <= body["harmonic_ratio"] <= 1
    assert "device" in body
    assert body.get("genre_predictions") is None or isinstance(body["genre_predictions"], list)


def test_analyze_image_requires_vision_extra():
    res = client.post(
        "/analyze-image",
        files={"file": ("dot.png", BytesIO(_MIN_PNG), "image/png")},
        data={"caption": "true"},
    )
    if vision_analysis_available():
        pytest.skip("vision extra installed in test env")
    assert res.status_code == 503


def test_generate_without_extra_returns_503():
    from ai_sidecar.musicgen import generation_available

    if generation_available():
        pytest.skip("generate extra installed in this environment")
    res = client.post("/generate", json={"prompt": "dark techno groove", "duration_sec": 5})
    assert res.status_code == 503
    assert "generate" in res.json()["detail"].lower()


def test_youtube_resolve_rejects_empty_url():
    res = client.post("/youtube/resolve", json={"url": ""})
    assert res.status_code in (400, 422)


def test_vocal_embed_plan_rejects_wrong_kind():
    res = client.post(
        "/vocal-embed/plan",
        json={
            "kind": "wrong_kind",
            "version": 1,
            "createdAt": "2026-01-01T00:00:00.000Z",
            "plan": {},
        },
    )
    assert res.status_code == 422


def test_vocal_embed_models_lists_status_keys():
    res = client.get("/vocal-embed/models")
    assert res.status_code == 200
    body = res.json()
    assert "rvc_ready" in body
    assert "diffsinger_configured" in body


def test_analyze_requires_token_when_configured(monkeypatch):
    monkeypatch.setattr("ai_sidecar.main._SIDECAR_TOKEN", "test-secret")
    wav = _make_tone_wav()
    res = client.post(
        "/analyze",
        files={"file": ("tone.wav", BytesIO(wav), "audio/wav")},
    )
    assert res.status_code == 401


def test_analyze_accepts_valid_sidecar_token(monkeypatch):
    monkeypatch.setattr("ai_sidecar.main._SIDECAR_TOKEN", "test-secret")
    wav = _make_tone_wav()
    res = client.post(
        "/analyze",
        files={"file": ("tone.wav", BytesIO(wav), "audio/wav")},
        headers={"x-aimc-sidecar-token": "test-secret"},
    )
    assert res.status_code == 200


def test_health_unauthenticated_when_token_configured(monkeypatch):
    monkeypatch.setattr("ai_sidecar.main._SIDECAR_TOKEN", "test-secret")
    res = client.get("/health")
    assert res.status_code == 200
