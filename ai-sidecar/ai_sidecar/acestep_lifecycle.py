"""Start the external ACE-Step API when Studio asks for a full song and :8001 is down.

Also restarts *our* child when the UI asks for a different DiT than the one loaded
at ACESTEP_CONFIG_PATH (one model at a time on a 12 GB card). Never kills an ACE
server this module did not spawn.
"""

from __future__ import annotations

import json
import os
import subprocess
import time
from pathlib import Path
from typing import Any

_START_LOCK = __import__("threading").Lock()
_CHILD: subprocess.Popen | None = None
_CHILD_CONFIG: str = ""

TURBO_MODEL = "acestep-v15-turbo"
QUALITY_MODEL = "acestep-v15-base"


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


def _checkpoint_dir(home: Path | None = None) -> Path | None:
    root = home if home is not None else _ace_home()
    if root is None:
        return None
    path = root / "checkpoints"
    return path if path.is_dir() else None


def _checkpoint_exists(model_id: str, *, home: Path | None = None) -> bool:
    name = str(model_id or "").strip()
    if not name:
        return False
    root = _checkpoint_dir(home)
    if root is None:
        return False
    return (root / name).is_dir()


def resolve_acestep_dit_model(
    requested: str = "",
    *,
    home: Path | None = None,
) -> tuple[str, str | None]:
    """Map UI / env model strings to a real ``acestep-v15-*`` checkpoint id.

    Returns ``(model_id, warning)``. Bare ``acestep-v15`` is treated as the quality
    intent and mapped to ``acestep-v15-base`` when that folder exists, else turbo.
    """
    raw = str(requested or "").strip()
    home_path = home if home is not None else _ace_home()

    if not raw or raw in ("turbo", TURBO_MODEL):
        return TURBO_MODEL, None

    quality_intent = raw in ("quality", "base", "acestep-v15", QUALITY_MODEL)
    if quality_intent:
        if _checkpoint_exists(QUALITY_MODEL, home=home_path):
            return QUALITY_MODEL, None
        return (
            TURBO_MODEL,
            f"checkpoint {QUALITY_MODEL} missing; using {TURBO_MODEL}",
        )

    if raw.startswith("acestep-v15-"):
        if home_path is not None and not _checkpoint_exists(raw, home=home_path):
            return (
                TURBO_MODEL,
                f"checkpoint {raw} missing; using {TURBO_MODEL}",
            )
        return raw, None

    return TURBO_MODEL, f"unknown ACE model {raw!r}; using {TURBO_MODEL}"


def should_restart_our_acestep_child(
    *,
    reachable: bool,
    loaded_model: str,
    desired_model: str,
    we_own_child: bool,
) -> bool:
    """True only when we own the ACE process and the loaded DiT differs from desired."""
    if not reachable or not we_own_child:
        return False
    loaded = str(loaded_model or "").strip()
    desired = str(desired_model or "").strip()
    if not loaded or not desired:
        return False
    return loaded != desired


def we_own_acestep_child() -> bool:
    return _CHILD is not None and _CHILD.poll() is None


def acestep_loaded_model(*, timeout_sec: float = 1.5) -> str:
    """Return the primary DiT name from ACE ``GET /v1/models`` when reachable."""
    from .acestep_bridge import acestep_api_key, acestep_api_url

    base = acestep_api_url()
    if not base:
        return ""
    import urllib.error
    import urllib.request

    headers: dict[str, str] = {}
    key = acestep_api_key()
    if key:
        headers["Authorization"] = f"Bearer {key}"
    try:
        req = urllib.request.Request(f"{base}/v1/models", headers=headers, method="GET")
        with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
            body = json.loads(resp.read().decode("utf-8", errors="replace"))
    except (urllib.error.URLError, TimeoutError, OSError, ValueError, json.JSONDecodeError):
        return ""
    return _parse_loaded_model(body)


def _normalize_dit_name(raw: str) -> str:
    text = str(raw or "").strip()
    if not text:
        return ""
    if "/" in text:
        text = text.rsplit("/", 1)[-1].strip()
    for part in text.replace(",", " ").split():
        if part.startswith("acestep-v15"):
            return part
    return text


def _parse_loaded_model(body: Any) -> str:
    if not isinstance(body, dict):
        return ""

    # Gradio wrap: { "data": { "default_model": "...", "models": [...] } }
    inner = body.get("data")
    if isinstance(inner, dict):
        default = _normalize_dit_name(str(inner.get("default_model") or ""))
        if default:
            return default
        models = inner.get("models")
        if isinstance(models, list) and models:
            first = models[0]
            if isinstance(first, dict):
                return _normalize_dit_name(str(first.get("name") or first.get("id") or ""))
            return _normalize_dit_name(str(first or ""))

    # OpenAI-style list: { "object": "list", "data": [ { "id": "acestep/acestep-v15-turbo" } ] }
    if isinstance(inner, list) and inner:
        first = inner[0]
        if isinstance(first, dict):
            return _normalize_dit_name(str(first.get("id") or first.get("name") or ""))
        return _normalize_dit_name(str(first or ""))

    default = _normalize_dit_name(str(body.get("default_model") or ""))
    if default:
        return default
    models = body.get("models")
    if isinstance(models, list) and models:
        first = models[0]
        if isinstance(first, dict):
            return _normalize_dit_name(str(first.get("name") or first.get("id") or ""))
        return _normalize_dit_name(str(first or ""))
    return ""


def _stop_our_child(*, wait_sec: float = 20.0) -> None:
    global _CHILD, _CHILD_CONFIG
    child = _CHILD
    _CHILD = None
    _CHILD_CONFIG = ""
    if child is None:
        return
    if child.poll() is not None:
        return
    try:
        child.terminate()
    except OSError:
        return
    deadline = time.monotonic() + max(2.0, wait_sec)
    while time.monotonic() < deadline:
        if child.poll() is not None:
            return
        time.sleep(0.4)
    try:
        child.kill()
    except OSError:
        pass


def _spawn_acestep_api(home: Path, *, port: str, config_path: str) -> subprocess.Popen:
    global _CHILD, _CHILD_CONFIG
    uv = "uv"
    venv_py = home / ".venv" / "Scripts" / "python.exe"
    if os.name != "nt":
        venv_py = home / ".venv" / "bin" / "python"
    if _which(uv):
        cmd = [
            uv,
            "run",
            "--directory",
            str(home),
            "--no-sync",
            "acestep-api",
            "--host",
            "127.0.0.1",
            "--port",
            port,
        ]
    elif venv_py.is_file():
        cmd = [
            str(venv_py),
            "-m",
            "uvicorn",
            "acestep.api_server:app",
            "--host",
            "127.0.0.1",
            "--port",
            port,
        ]
    else:
        raise RuntimeError(f"Need uv or {venv_py} to start ACE-Step")

    env = os.environ.copy()
    env["ACESTEP_CONFIG_PATH"] = config_path
    env["ACESTEP_ON_DEMAND_MODEL_LOAD"] = "true"
    # One DiT on consumer GPUs — do not preload secondary configs.
    env.pop("ACESTEP_CONFIG_PATH2", None)
    env.pop("ACESTEP_CONFIG_PATH3", None)

    _CHILD = subprocess.Popen(
        cmd,
        cwd=str(home),
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    _CHILD_CONFIG = config_path
    return _CHILD


def ensure_acestep_api(*, wait_sec: float = 90.0, model: str = "") -> str:
    """Return the API base URL, starting or restarting our ACE child when needed."""
    from .acestep_bridge import acestep_api_url, acestep_reachable

    base = acestep_api_url() or "http://127.0.0.1:8001"
    if not os.environ.get("AIMC_ACESTEP_API_URL", "").strip():
        os.environ["AIMC_ACESTEP_API_URL"] = base

    desired, warning = resolve_acestep_dit_model(model)
    if warning:
        # Surface via stderr for sidecar logs; callers may also pass model in payload.
        print(f"[acestep_lifecycle] {warning}", flush=True)

    home = _ace_home()
    port = "8001"
    if ":" in base.rsplit("/", 1)[-1]:
        port = base.rsplit(":", 1)[-1]

    with _START_LOCK:
        reachable = acestep_reachable(timeout_sec=0.6)
        loaded = acestep_loaded_model(timeout_sec=1.0) if reachable else ""
        own = we_own_acestep_child()

        if should_restart_our_acestep_child(
            reachable=reachable,
            loaded_model=loaded or _CHILD_CONFIG,
            desired_model=desired,
            we_own_child=own,
        ):
            _stop_our_child()
            reachable = False

        if reachable:
            return base

        if home is None:
            raise RuntimeError(
                "ACE-Step API unreachable and no checkout found — set AIMC_ACESTEP_HOME or run npm run sidecar:acestep"
            )

        if acestep_reachable(timeout_sec=0.4):
            return base

        _spawn_acestep_api(home, port=port, config_path=desired)

    deadline = time.monotonic() + max(5.0, wait_sec)
    while time.monotonic() < deadline:
        if acestep_reachable(timeout_sec=0.8):
            return base
        time.sleep(1.5)
    raise RuntimeError(f"ACE-Step API did not become ready at {base}")


def _which(name: str) -> bool:
    from shutil import which

    return which(name) is not None
