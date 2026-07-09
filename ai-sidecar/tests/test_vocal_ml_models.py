"""Tests for optional RVC / DiffSinger configuration."""

from ai_sidecar.vocal_ml_models import (
    diffsinger_configured,
    full_ml_vocal_models_available,
    rvc_model_configured,
    rvc_ready,
    vocal_model_status,
)


def test_vocal_model_status_defaults(monkeypatch):
    monkeypatch.delenv("AIMC_RVC_MODEL", raising=False)
    monkeypatch.delenv("AIMC_RVC_API_URL", raising=False)
    monkeypatch.delenv("AIMC_DIFFSINGER_CMD", raising=False)
    monkeypatch.delenv("AIMC_DIFFSINGER_URL", raising=False)

    status = vocal_model_status()
    assert status["rvc_ready"] is False
    assert status["diffsinger_configured"] is False
    assert status["models_ready"] is False


def test_rvc_api_counts_as_ready(monkeypatch):
    monkeypatch.setenv("AIMC_RVC_API_URL", "http://127.0.0.1:5050")
    assert rvc_ready() is True
    assert full_ml_vocal_models_available() is True


def test_diffsinger_openvpi_root_counts_as_configured(monkeypatch, tmp_path):
    infer = tmp_path / "scripts"
    infer.mkdir(parents=True)
    (infer / "infer.py").write_text("# stub", encoding="utf-8")
    monkeypatch.delenv("AIMC_RVC_API_URL", raising=False)
    monkeypatch.delenv("AIMC_DIFFSINGER_CMD", raising=False)
    monkeypatch.setenv("AIMC_DIFFSINGER_ROOT", str(tmp_path))
    monkeypatch.setenv("AIMC_DIFFSINGER_ACOUSTIC_EXP", "my_acoustic")
    assert diffsinger_configured() is True
    assert full_ml_vocal_models_available() is True


def test_diffsinger_cmd_counts_as_configured(monkeypatch):
    monkeypatch.delenv("AIMC_RVC_API_URL", raising=False)
    monkeypatch.delenv("AIMC_DIFFSINGER_ROOT", raising=False)
    monkeypatch.setenv("AIMC_DIFFSINGER_CMD", "python diffsinger_infer.py")
    assert diffsinger_configured() is True
    assert full_ml_vocal_models_available() is True


def test_rvc_model_path_flag(monkeypatch, tmp_path):
    model = tmp_path / "voice.pth"
    model.write_bytes(b"stub")
    monkeypatch.setenv("AIMC_RVC_MODEL", str(model))
    assert rvc_model_configured() is True
