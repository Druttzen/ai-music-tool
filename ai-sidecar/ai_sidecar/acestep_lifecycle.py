"""Start the external ACE-Step API when Studio asks for a full song and :8001 is down.

Restarts the ACE process when the loaded DiT differs from the requested preset.
That includes a server this module spawned and a listener whose command line is
ACE-Step's API. Unrelated processes on the port are left alone.
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
_LOG_HANDLE: Any = None

TURBO_MODEL = "acestep-v15-turbo"
QUALITY_MODEL = "acestep-v15-base"


def _fixed_drive_roots() -> list[str]:
    """Windows fixed-drive roots only. Skips CD/network drives that can stall on stat."""
    if os.name != "nt":
        return []
    try:
        import ctypes

        kernel = ctypes.windll.kernel32
        mask = int(kernel.GetLogicalDrives())
        roots: list[str] = []
        for index in range(26):
            if not mask & (1 << index):
                continue
            root = f"{chr(65 + index)}:\\"
            if int(kernel.GetDriveTypeW(root)) == 3:
                roots.append(root)
        return roots
    except (AttributeError, OSError):
        return []


def ace_home_candidates() -> list[str]:
    """Checkout locations, most specific first. No single machine path is required."""
    candidates: list[str] = [
        os.environ.get("AIMC_ACESTEP_HOME", ""),
        os.environ.get("ACESTEP_HOME", ""),
    ]
    repo = os.environ.get("AIMC_REPO_ROOT", "")
    if repo:
        candidates.append(str(Path(repo).parent / "ACE-Step-1.5"))
    here = Path(__file__).resolve()
    if len(here.parents) >= 3:
        candidates.append(str(here.parents[2].parent / "ACE-Step-1.5"))
    candidates.append(str(Path.home() / "ACE-Step-1.5"))
    for root in _fixed_drive_roots():
        candidates.append(str(Path(root) / "ACE-Step-1.5"))
    return candidates


def _ace_home() -> Path | None:
    candidates = ace_home_candidates()
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


def cmdline_looks_like_acestep(cmdline: str) -> bool:
    text = str(cmdline or "").lower()
    if "acestep" not in text:
        return False
    return "acestep-api" in text or "acestep.api_server" in text or "api_server" in text


def should_restart_our_acestep_child(
    *,
    reachable: bool,
    loaded_model: str,
    desired_model: str,
    we_own_child: bool,
    listener_is_ace: bool = False,
) -> bool:
    """True when the loaded DiT differs and the listener is ours or an ACE API process."""
    if not reachable or not (we_own_child or listener_is_ace):
        return False
    loaded = str(loaded_model or "").strip()
    desired = str(desired_model or "").strip()
    if not loaded or not desired:
        return False
    return loaded != desired


def preset_catalog() -> dict[str, Any]:
    """Which DiT presets exist on disk. Quality stays off when the base checkpoint is missing."""
    home = _ace_home()
    quality_ok = _checkpoint_exists(QUALITY_MODEL, home=home)
    return {
        "turbo_model": TURBO_MODEL,
        "quality_model": QUALITY_MODEL,
        "quality_available": quality_ok,
        "home": str(home) if home else "",
        "note": "" if quality_ok else f"checkpoint {QUALITY_MODEL} is not installed",
    }


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


def _listener_pids(port: str) -> list[int]:
    """PIDs listening on ``port``. Best-effort; empty when the lookup fails."""
    import re

    pids: list[int] = []
    try:
        if os.name == "nt":
            proc = subprocess.run(
                ["netstat", "-ano", "-p", "tcp"],
                capture_output=True,
                text=True,
                timeout=8,
                check=False,
            )
            needle = f":{port}"
            for line in (proc.stdout or "").splitlines():
                if "LISTENING" not in line.upper() or needle not in line:
                    continue
                parts = line.split()
                if parts and parts[-1].isdigit():
                    pids.append(int(parts[-1]))
        else:
            proc = subprocess.run(
                ["ss", "-ltnp"],
                capture_output=True,
                text=True,
                timeout=8,
                check=False,
            )
            for line in (proc.stdout or "").splitlines():
                if f":{port}" not in line:
                    continue
                match = re.search(r"pid=(\d+)", line)
                if match:
                    pids.append(int(match.group(1)))
    except (OSError, subprocess.TimeoutExpired):
        return []
    return list(dict.fromkeys(pids))


def _process_command_line(pid: int) -> str:
    if pid <= 0:
        return ""
    try:
        if os.name == "nt":
            proc = subprocess.run(
                [
                    "powershell",
                    "-NoProfile",
                    "-Command",
                    f"(Get-CimInstance Win32_Process -Filter \"ProcessId={int(pid)}\").CommandLine",
                ],
                capture_output=True,
                text=True,
                timeout=8,
                check=False,
            )
            return (proc.stdout or "").strip()
        proc = subprocess.run(
            ["ps", "-p", str(int(pid)), "-o", "args="],
            capture_output=True,
            text=True,
            timeout=8,
            check=False,
        )
        return (proc.stdout or "").strip()
    except (OSError, subprocess.TimeoutExpired):
        return ""


def listener_is_acestep(port: str) -> bool:
    for pid in _listener_pids(port):
        if cmdline_looks_like_acestep(_process_command_line(pid)):
            return True
    return False


def _stop_acestep_listeners(port: str) -> None:
    """Stop ACE API listeners on ``port``. Other processes are left running."""
    for pid in _listener_pids(port):
        if not cmdline_looks_like_acestep(_process_command_line(pid)):
            continue
        try:
            if os.name == "nt":
                subprocess.run(
                    ["taskkill", "/PID", str(pid), "/F"],
                    capture_output=True,
                    timeout=8,
                    check=False,
                )
            else:
                os.kill(pid, 15)
        except (OSError, subprocess.TimeoutExpired):
            continue


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
    global _CHILD, _CHILD_CONFIG, _LOG_HANDLE
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

    if _LOG_HANDLE is not None:
        try:
            _LOG_HANDLE.close()
        except OSError:
            pass
        _LOG_HANDLE = None
    log_path = home / "acestep-api.log"
    log_handle = open(log_path, "ab", buffering=0)
    _LOG_HANDLE = log_handle
    _CHILD = subprocess.Popen(
        cmd,
        cwd=str(home),
        env=env,
        stdout=log_handle,
        stderr=subprocess.STDOUT,
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
        foreign_ace = listener_is_acestep(port) if reachable and not own else False

        if should_restart_our_acestep_child(
            reachable=reachable,
            loaded_model=loaded or _CHILD_CONFIG,
            desired_model=desired,
            we_own_child=own,
            listener_is_ace=foreign_ace,
        ):
            if own:
                _stop_our_child()
            else:
                _stop_acestep_listeners(port)
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
