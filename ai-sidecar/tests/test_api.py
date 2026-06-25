"""Sidecar API tests (no torch/demucs required for analyze)."""

from io import BytesIO

import pytest
from fastapi.testclient import TestClient

from ai_sidecar.main import app

client = TestClient(app)


def test_health_ok():
    res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert "device" in body


def test_health_allows_local_dev_cors():
    res = client.get("/health", headers={"Origin": "http://localhost:3000"})
    assert res.status_code == 200
    assert res.headers.get("access-control-allow-origin") == "http://localhost:3000"


def test_dev_session_ping():
    res = client.post("/dev-session/ping")
    assert res.status_code == 200
    assert res.json()["ok"] is True


def test_separate_without_stems_extra_returns_503():
    res = client.post(
        "/separate",
        files={"file": ("test.wav", BytesIO(b"RIFF"), "audio/wav")},
    )
    assert res.status_code == 503
    assert "stems" in res.json()["detail"].lower() or "unavailable" in res.json()["detail"].lower()
