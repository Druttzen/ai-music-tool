"""Exit the sidecar after a period with no real inference traffic."""

from __future__ import annotations

import os
import threading
import time

_IDLE_EXIT_SEC = float(os.environ.get("SIDECAR_IDLE_EXIT_SEC", "0"))
_LAST_ACTIVITY = time.monotonic()
_DEV_SESSION_UNTIL = 0.0
_LOCK = threading.Lock()
_WATCHDOG_STARTED = False

# Only these routes count as tool use (/health probes do not extend the timer).
_ACTIVITY_PATHS = frozenset({
    "/analyze",
    "/separate",
    "/dev-session/ping",
    "/vocal-embed/plan",
    "/vocal-embed/synthesize",
})


def configure_idle_exit(idle_exit_sec: float) -> None:
    global _IDLE_EXIT_SEC
    _IDLE_EXIT_SEC = max(0.0, idle_exit_sec)


def touch_activity() -> None:
    global _LAST_ACTIVITY
    with _LOCK:
        _LAST_ACTIVITY = time.monotonic()


def hold_dev_session(grace_sec: float = 45.0) -> None:
    """Suppress idle shutdown while a local dev watcher reports the UI is running."""
    global _DEV_SESSION_UNTIL, _LAST_ACTIVITY
    until = time.monotonic() + max(5.0, grace_sec)
    with _LOCK:
        _DEV_SESSION_UNTIL = max(_DEV_SESSION_UNTIL, until)
        _LAST_ACTIVITY = time.monotonic()


def dev_session_active() -> bool:
    with _LOCK:
        return time.monotonic() < _DEV_SESSION_UNTIL


def start_idle_watchdog() -> None:
    global _WATCHDOG_STARTED
    if _WATCHDOG_STARTED or _IDLE_EXIT_SEC <= 0:
        return
    _WATCHDOG_STARTED = True

    def _watch() -> None:
        while True:
            time.sleep(min(30.0, max(5.0, _IDLE_EXIT_SEC / 4.0)))
            with _LOCK:
                idle = time.monotonic() - _LAST_ACTIVITY
                dev_hold = time.monotonic() < _DEV_SESSION_UNTIL
            if _IDLE_EXIT_SEC > 0 and idle >= _IDLE_EXIT_SEC and not dev_hold:
                os._exit(0)

    threading.Thread(target=_watch, daemon=True, name="sidecar-idle-watchdog").start()


def is_activity_path(path: str) -> bool:
    if path in _ACTIVITY_PATHS:
        return True
    return path.startswith("/separate/download/")
