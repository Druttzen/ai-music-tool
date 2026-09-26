"""Async melody-conditioned MusicGen job endpoint tests."""

from fastapi.testclient import TestClient

from ai_sidecar.main import app


def test_enqueue_melody_generation_job(monkeypatch):
    calls = {}

    def enqueue(prompt, **kwargs):
        calls["prompt"] = prompt
        calls.update(kwargs)
        return "melody-job-1"

    monkeypatch.setattr("ai_sidecar.main.generation_available", lambda: True)
    monkeypatch.setattr("ai_sidecar.main.enqueue_musicgen", enqueue)

    client = TestClient(app)
    response = client.post(
        "/generate/melody/jobs",
        data={"prompt": "  bright synth  ", "duration_sec": "8", "model": "medium"},
        files={"melody": ("reference.wav", b"RIFF", "audio/wav")},
    )

    assert response.status_code == 200
    assert response.json() == {"job_id": "melody-job-1"}
    assert calls == {
        "prompt": "bright synth",
        "duration_sec": 8.0,
        "melody_wav": b"RIFF",
        "temperature": None,
        "top_k": None,
        "top_p": None,
        "cfg_coef": None,
        "seed": None,
        "model": "medium",
    }
