"""Tests for sidecar idle shutdown helpers."""

from ai_sidecar.idle import configure_idle_exit, dev_session_active, hold_dev_session, is_activity_path, touch_activity


def test_activity_paths():
    assert is_activity_path("/analyze")
    assert is_activity_path("/separate")
    assert is_activity_path("/vocal-embed/plan")
    assert is_activity_path("/vocal-embed/synthesize")
    assert not is_activity_path("/health")
    assert not is_activity_path("/docs")


def test_configure_idle_exit_clamps_negative():
    configure_idle_exit(-5)
    touch_activity()


def test_dev_session_hold():
    hold_dev_session(60.0)
    assert dev_session_active()
