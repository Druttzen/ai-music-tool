"""Tests for Fail-Safe Runtime delivery (maintainer mode)."""

from __future__ import annotations

import os

from fastapi.testclient import TestClient

from ai_sidecar.fail_safe_runtime import RuntimeDeliverRequest, deliver_runtime_report
from ai_sidecar.main import app


def test_runtime_deliver_rejects_without_maintainer(monkeypatch):
    monkeypatch.delenv("AIMC_MAINTAINER", raising=False)
    result = deliver_runtime_report(RuntimeDeliverRequest(payload={"issueTitle": "x"}))
    assert result.ok is False
    assert result.stage == "auth"


def test_runtime_deliver_endpoint(monkeypatch):
    monkeypatch.delenv("AIMC_MAINTAINER", raising=False)
    client = TestClient(app)
    res = client.post(
        "/fail-safe/runtime-deliver",
        json={"payload": {"issueTitle": "test"}, "mode": "issue"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["ok"] is False
    assert body["stage"] == "auth"


def test_runtime_deliver_branch_requires_repo_root(monkeypatch):
    monkeypatch.setenv("AIMC_MAINTAINER", "1")
    monkeypatch.setattr("ai_sidecar.fail_safe_runtime.repo_root", lambda: "")
    result = deliver_runtime_report(
        RuntimeDeliverRequest(payload={"issueTitle": "x", "issueBody": "y"}, mode="pr"),
    )
    assert result.ok is False
    assert result.stage == "config"
