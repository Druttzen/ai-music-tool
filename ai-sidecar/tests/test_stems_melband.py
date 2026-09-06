"""Unit tests for Mel-Band routing helpers (no model download required)."""

import sys

from ai_sidecar.stems_melband import (
    _select_torch_device,
    is_melband_model_name,
    resolve_melband_model_id,
)
from ai_sidecar.stems_separate import preferred_stems_backend


def test_is_melband_model_name():
    assert is_melband_model_name("melband")
    assert is_melband_model_name("melband-roformer-kim-vocals")
    assert not is_melband_model_name("htdemucs")
    assert not is_melband_model_name("")


def test_resolve_melband_model_id(monkeypatch):
    monkeypatch.delenv("AIMC_MELBAND_MODEL", raising=False)
    assert resolve_melband_model_id("melband") == "melband-roformer-kim-vocals"
    monkeypatch.setenv("AIMC_MELBAND_MODEL", "melband-roformer-big-beta7")
    assert resolve_melband_model_id("melband") == "melband-roformer-big-beta7"
    assert resolve_melband_model_id("melband-roformer-kim-vocals") == "melband-roformer-kim-vocals"


def test_preferred_stems_backend(monkeypatch):
    monkeypatch.delenv("AIMC_STEMS_BACKEND", raising=False)
    assert preferred_stems_backend() == "demucs"
    monkeypatch.setenv("AIMC_STEMS_BACKEND", "melband")
    assert preferred_stems_backend() == "melband"


def test_select_torch_device_prefers_cuda(monkeypatch):
    class _FakeTorch:
        class cuda:
            @staticmethod
            def is_available():
                return True

        class backends:
            mps = None

    monkeypatch.setitem(sys.modules, "torch", _FakeTorch)
    assert _select_torch_device("cpu") == "cuda"


def test_select_torch_device_falls_back_to_cpu(monkeypatch):
    class _FakeTorch:
        class cuda:
            @staticmethod
            def is_available():
                return False

        class backends:
            mps = None

    monkeypatch.setitem(sys.modules, "torch", _FakeTorch)
    assert _select_torch_device("cuda") == "cpu"
