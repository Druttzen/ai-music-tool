"""Async melody-conditioned MusicGen job endpoint tests."""

import asyncio
import threading

from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient

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


def test_melody_capability_probe_does_not_block_health(monkeypatch):
    entered = threading.Event()
    release = threading.Event()

    def slow_capability_probe():
        entered.set()
        release.wait(timeout=2)
        return True

    monkeypatch.setattr("ai_sidecar.main.generation_available", slow_capability_probe)
    monkeypatch.setattr("ai_sidecar.main.enqueue_musicgen", lambda *_args, **_kwargs: "melody-job-2")

    async def exercise_concurrent_health():
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            queued = asyncio.create_task(
                client.post(
                    "/generate/melody/jobs",
                    data={"prompt": "ambient sketch", "duration_sec": "5"},
                    files={"melody": ("reference.wav", b"RIFF", "audio/wav")},
                )
            )
            assert await asyncio.to_thread(entered.wait, 1)
            health = await asyncio.wait_for(client.get("/health"), timeout=1)
            release.set()
            response = await asyncio.wait_for(queued, timeout=3)
            assert health.status_code == 200
            assert response.status_code == 200
            assert response.json() == {"job_id": "melody-job-2"}

    release_timer = threading.Timer(1.5, release.set)
    release_timer.start()
    try:
        asyncio.run(exercise_concurrent_health())
    finally:
        release.set()
        release_timer.cancel()
