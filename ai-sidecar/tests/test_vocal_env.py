"""Tests for optional .env.vocal loader."""

from pathlib import Path

from ai_sidecar.vocal_env import load_vocal_env_file


def test_load_vocal_env_file_applies_keys(tmp_path, monkeypatch):
    env_file = tmp_path / ".env.vocal"
    env_file.write_text(
        "AIMC_RVC_MODEL=C:\\models\\voice.pth\nAIMC_RVC_API_URL=http://127.0.0.1:5050\n",
        encoding="utf-8",
    )
    monkeypatch.delenv("AIMC_RVC_MODEL", raising=False)
    monkeypatch.delenv("AIMC_RVC_API_URL", raising=False)

    loaded = load_vocal_env_file(env_file)
    assert "AIMC_RVC_MODEL" in loaded
    assert "AIMC_RVC_API_URL" in loaded


def test_load_vocal_env_file_missing_returns_empty(tmp_path):
    assert load_vocal_env_file(tmp_path / "missing.env.vocal") == []
