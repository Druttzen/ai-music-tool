"""Vocal Embed Studio plan validation."""

from fastapi.testclient import TestClient

from ai_sidecar.main import app
from ai_sidecar.vocal_synth import synthesis_stack_available

client = TestClient(app)


def _ready_plan():
    return {
        "kind": "vocal_embed_plan",
        "version": 1,
        "createdAt": "2026-07-09T00:00:00.000Z",
        "plan": {
            "stage": "ready",
            "sidecarMode": "guide-vocal-conversion",
            "warnings": [],
            "sections": [{"name": "Verse", "start": 10, "end": 40, "lineCount": 4}],
        },
    }


def test_health_includes_vocal_embed_flags():
    res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["vocal_embed_plan_available"] is True
    assert body["vocal_synthesis_available"] is synthesis_stack_available()
    from ai_sidecar.vocal_ml import ml_vocal_stack_available

    assert body["vocal_ml_available"] is ml_vocal_stack_available()


def test_vocal_embed_models_endpoint():
    res = client.get("/vocal-embed/models")
    assert res.status_code == 200
    body = res.json()
    assert "rvc_ready" in body
    assert "diffsinger_configured" in body
    assert "models_ready" in body

    res = client.post("/vocal-embed/plan", json=_ready_plan())
    assert res.status_code == 200
    body = res.json()
    assert body["ok"] is True
    assert body["section_count"] == 1
    assert body["mode"] == "guide-vocal-conversion"
    assert body["synthesis_available"] is synthesis_stack_available()
    assert body["next_steps"]


def test_vocal_embed_plan_rejects_draft():
    payload = _ready_plan()
    payload["plan"]["stage"] = "draft"
    payload["plan"]["warnings"] = ["Add lyrics"]
    res = client.post("/vocal-embed/plan", json=payload)
    assert res.status_code == 422


def test_vocal_embed_ds_export_from_plan():
    payload = _ready_plan()
    payload["plan"]["lyrics"] = "[Verse]\nhello world"
    payload["plan"]["bpm"] = "120 BPM"
    payload["plan"]["key"] = "Am"
    payload["plan"]["sections"] = [
        {"name": "Verse", "start": 0.0, "end": 4.0, "lineCount": 1, "text": "hello world"},
    ]
    res = client.post(
        "/vocal-embed/ds-export",
        data={"plan_json": __import__("json").dumps(payload)},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["format"] == "openvpi-ds-segments"
    assert body["segment_count"] >= 1
    assert body["segments"][0]["note_seq"]


def test_vocal_embed_plan_reports_openvpi_ds_segments():
    payload = _ready_plan()
    payload["openvpiDs"] = {
        "format": "openvpi-ds-segments",
        "segment_count": 2,
        "segments": [{"text": "one"}, {"text": "two"}],
    }
    res = client.post("/vocal-embed/plan", json=payload)
    assert res.status_code == 200
    body = res.json()
    assert body["openvpi_ds_segments"] == 2
