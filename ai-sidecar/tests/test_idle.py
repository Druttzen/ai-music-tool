"""Tests for sidecar idle shutdown helpers."""

from ai_sidecar.idle import configure_idle_exit, dev_session_active, hold_dev_session, is_activity_path, touch_activity
from ai_sidecar import idle
import pytest


def test_activity_paths():
    assert is_activity_path("/analyze")
    assert is_activity_path("/separate")
    assert is_activity_path("/vocal-embed/plan")
    assert is_activity_path("/vocal-embed/models")
    assert is_activity_path("/vocal-embed/synthesize")
    assert is_activity_path("/vocal-embed/ds-export")
    assert not is_activity_path("/health")
    assert not is_activity_path("/docs")


def test_configure_idle_exit_clamps_negative():
    configure_idle_exit(-5)
    touch_activity()


def test_dev_session_hold():
    hold_dev_session(60.0)
    assert dev_session_active()


def test_nested_activity_sessions_keep_work_alive_and_release_on_error():
    original = idle._ACTIVE_OPERATIONS
    with pytest.raises(RuntimeError):
        with idle.activity_session():
            assert idle._ACTIVE_OPERATIONS == original + 1
            with idle.activity_session():
                assert idle._ACTIVE_OPERATIONS == original + 2
                raise RuntimeError("failed inference")
    assert idle._ACTIVE_OPERATIONS == original
