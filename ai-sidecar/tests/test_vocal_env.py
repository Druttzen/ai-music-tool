"""Tests for optional .env.vocal loader."""

from pathlib import Path
import os

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


def test_default_loader_reads_packaged_studio_data_env(tmp_path, monkeypatch):
    studio_data = tmp_path / "StudioData"
    env_file = studio_data / "sidecar" / "pkg" / ".env.vocal"
    env_file.parent.mkdir(parents=True)
    env_file.write_text("AIMC_ACESTEP_API_URL=http://127.0.0.1:8001\n", encoding="utf-8")
    monkeypatch.setenv("STUDIO_DATA_DIR", str(studio_data))
    monkeypatch.delenv("AIMC_ACESTEP_API_URL", raising=False)

    loaded = load_vocal_env_file()

    assert "AIMC_ACESTEP_API_URL" in loaded
    assert os.environ["AIMC_ACESTEP_API_URL"] == "http://127.0.0.1:8001"


def test_explicit_env_path_does_not_read_studio_data_fallback(tmp_path, monkeypatch):
    studio_data = tmp_path / "StudioData"
    env_file = studio_data / "sidecar" / "pkg" / ".env.vocal"
    env_file.parent.mkdir(parents=True)
    env_file.write_text("AIMC_ACESTEP_API_URL=http://127.0.0.1:8001\n", encoding="utf-8")
    monkeypatch.setenv("STUDIO_DATA_DIR", str(studio_data))
    monkeypatch.delenv("AIMC_ACESTEP_API_URL", raising=False)

    assert load_vocal_env_file(tmp_path / "missing.env.vocal") == []
