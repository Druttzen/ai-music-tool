"""The generated frontend contracts must match the actual FastAPI boundary."""

import json
from pathlib import Path

from fastapi.testclient import TestClient

from ai_sidecar.jobs import Job
from ai_sidecar.main import app


def test_job_routes_have_explicit_public_response_models():
    paths = app.openapi()["paths"]
    expected = {
        ("/generate/jobs", "post"): "JobSubmission",
        ("/generate/melody/jobs", "post"): "JobSubmission",
        ("/generate/song/jobs", "post"): "JobSubmission",
        ("/jobs/{job_id}", "get"): "PublicJobStatus",
        ("/jobs/{job_id}/cancel", "post"): "JobCancelResponse",
        ("/acestep/presets", "get"): "AceStepPresetCatalog",
        ("/fail-safe/capabilities", "get"): "FailSafeCapabilities",
        ("/vocal-embed/models", "get"): "VocalModelStatus",
        ("/vocal-embed/align-preview", "post"): "VocalAlignPreviewResponse",
        ("/vocal-embed/ds-export", "post"): "OpenvpiDsExportResponse",
    }
    for (path, method), model in expected.items():
        schema = paths[path][method]["responses"]["200"]["content"]["application/json"]["schema"]
        assert schema == {"$ref": f"#/components/schemas/{model}"}


def test_health_nested_contracts_are_typed():
    properties = app.openapi()["components"]["schemas"]["Health"]["properties"]
    assert properties["device_info"]["anyOf"][0]["$ref"].endswith("/DeviceInfo")
    assert properties["capabilities"]["anyOf"][0]["items"]["$ref"].endswith("/CapabilityContract")


def test_public_job_response_keeps_nullable_metadata_and_excludes_paths(monkeypatch):
    job = Job(job_id="contract-test", kind="generate", status="done", progress=1.0,
              result={"path": "private/temp/audio.wav", "model": "test-model", "meta": {"duration_sec": 30}})
    monkeypatch.setattr("ai_sidecar.main.JOBS.get", lambda _job_id: job)
    response = TestClient(app).get("/jobs/contract-test")
    assert response.status_code == 200
    body = response.json()
    assert body["result"] == {
        "ready": True, "model": "test-model", "duration_sec": 30,
        "mode": None, "audio_format": None,
    }
    assert body["error"] is None
    assert "private/temp" not in response.text


def test_checked_in_openapi_matches_backend():
    root = Path(__file__).resolve().parents[2]
    snapshot = json.loads((root / "docs" / "sidecar-openapi.json").read_text(encoding="utf-8"))
    assert snapshot == app.openapi(), "Run npm run contracts:sidecar after changing Python contracts"
