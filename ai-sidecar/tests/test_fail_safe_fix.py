"""Tests for in-app fail-safe fix + push."""

from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

from ai_sidecar.fail_safe_fix import FixPushRequest, fix_push, maintainer_enabled
from ai_sidecar.main import app


def test_maintainer_disabled_by_default(monkeypatch):
    monkeypatch.delenv("AIMC_MAINTAINER", raising=False)
    assert maintainer_enabled() is False
    result = fix_push(FixPushRequest(mode="local"))
    assert result.ok is False
    assert result.stage == "auth"


def test_fail_safe_capabilities_endpoint(monkeypatch):
    monkeypatch.setenv("AIMC_MAINTAINER", "1")
    monkeypatch.setenv("AIMC_REPO_ROOT", os.getcwd())
    client = TestClient(app)
    res = client.get("/fail-safe/capabilities")
    assert res.status_code == 200
    body = res.json()
    assert body["maintainer_mode"] is True


def test_fix_push_rejects_without_maintainer(monkeypatch):
    monkeypatch.delenv("AIMC_MAINTAINER", raising=False)
    client = TestClient(app)
    res = client.post("/fail-safe/fix-push", json={"mode": "local"})
    assert res.status_code == 200
    body = res.json()
    assert body["ok"] is False
