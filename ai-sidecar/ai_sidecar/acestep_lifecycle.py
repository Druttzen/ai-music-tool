"""Start the external ACE-Step API when Studio asks for a full song and :8001 is down."""

from __future__ import annotations

import os
import subprocess
import time
from pathlib import Path

_START_LOCK = __import__("threading").Lock()
_CHILD: subprocess.Popen | None = None


def _ace_home() -> Path | None:
    candidates = [
        os.environ.get("AIMC_ACESTEP_HOME", ""),
        os.environ.get("ACESTEP_HOME", ""),
        r"F:\ACE-Step-1.5",
    ]
    repo = os.environ.get("AIMC_REPO_ROOT", "")
    if repo:
        candidates.append(str(Path(repo).parent / "ACE-Step-1.5"))
    for raw in candidates:
        text = str(raw or "").strip()
        if not text:
            continue
        path = Path(text)
        if (path / "pyproject.toml").is_file() or (path / "start_api_server.bat").is_file():
            return path
    return None


def ensure_acestep_api(*, wait_sec: float = 90.0) -> str:
    """Return the API base URL, starting the local ACE-Step server when it is down."""
    from .acestep_bridge import acestep_api_url, acestep_reachable

    base = acestep_api_url() or "http://127.0.0.1:8001"
    if not os.environ.get("AIMC_ACESTEP_API_URL", "").strip():
        os.environ["AIMC_ACESTEP_API_URL"] = base
    if acestep_reachable(timeout_sec=0.6):
        return base

    home = _ace_home()
    if home is None:
        raise RuntimeError(
            "ACE-Step API unreachable and no checkout found — set AIMC_ACESTEP_HOME or run npm run sidecar:acestep"
        )

    global _CHILD
    with _START_LOCK:
        if acestep_reachable(timeout_sec=0.4):
            return base
        port = "8001"
        if ":" in base.rsplit("/", 1)[-1]:
            port = base.rsplit(":", 1)[-1]
        uv = "uv"
        venv_py = home / ".venv" / "Scripts" / "python.exe"
        if os.name != "nt":
            venv_py = home / ".venv" / "bin" / "python"
        if _which(uv):
            cmd = [uv, "run", "--directory", str(home), "--no-sync", "acestep-api", "--host", "127.0.0.1", "--port", port]
        elif venv_py.is_file():
            cmd = [str(venv_py), "-m", "uvicorn", "acestep.api_server:app", "--host", "127.0.0.1", "--port", port]
        else:
            raise RuntimeError(f"Need uv or {venv_py} to start ACE-Step")
        _CHILD = subprocess.Popen(
            cmd,
            cwd=str(home),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

    deadline = time.monotonic() + max(5.0, wait_sec)
    while time.monotonic() < deadline:
        if acestep_reachable(timeout_sec=0.8):
            return base
        time.sleep(1.5)
    raise RuntimeError(f"ACE-Step API did not become ready at {base}")


def _which(name: str) -> bool:
    from shutil import which

    return which(name) is not None
