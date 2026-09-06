"""Unit tests for MFA align helpers (no MFA binary required)."""

from ai_sidecar.vocal_align import mfa_bin_name, mfa_configured, mfa_ready


def test_mfa_configured_requires_model_and_dict(monkeypatch):
    monkeypatch.delenv("AIMC_MFA_MODEL", raising=False)
    monkeypatch.delenv("AIMC_MFA_DICT", raising=False)
    assert mfa_configured() is False
    monkeypatch.setenv("AIMC_MFA_MODEL", "english_mfa")
    assert mfa_configured() is False
    monkeypatch.setenv("AIMC_MFA_DICT", "english_mfa")
    assert mfa_configured() is True


def test_mfa_ready_requires_binary(monkeypatch):
    monkeypatch.setenv("AIMC_MFA_MODEL", "english_mfa")
    monkeypatch.setenv("AIMC_MFA_DICT", "english_mfa")
    monkeypatch.setenv("AIMC_MFA_BIN", "mfa-not-installed-xyz")
    monkeypatch.setattr("ai_sidecar.vocal_align.shutil.which", lambda _name: None)
    assert mfa_ready() is False
    monkeypatch.setattr("ai_sidecar.vocal_align.shutil.which", lambda _name: "/usr/bin/mfa")
    assert mfa_ready() is True
    assert mfa_bin_name() == "mfa-not-installed-xyz"
