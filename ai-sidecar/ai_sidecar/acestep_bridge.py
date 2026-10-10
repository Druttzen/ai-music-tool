"""Full-song generation through the app-owned internal ACE-Step plugin."""

from __future__ import annotations

import json
import os
import time
from typing import Any

DEFAULT_TIMEOUT_SEC = 1800.0
_POLL_INTERVAL_SEC = 2.0
_MIN_DURATION_SEC = 10.0
_MAX_DURATION_SEC = 600.0

SONG_MEDIA_TYPES = {
    "wav": "audio/wav",
    "wav32": "audio/wav",
    "mp3": "audio/mpeg",
    "flac": "audio/flac",
    # ACE-Step API accepts `aac`; treat m4a as the same delivery intent.
    "aac": "audio/mp4",
    "m4a": "audio/mp4",
    "opus": "audio/opus",
}


_PLUGIN_URL = ""
_PLUGIN_KEY = ""

def configure_internal_acestep() -> None:
    global _PLUGIN_URL, _PLUGIN_KEY
    import secrets
    import socket
    from .internal_plugins import active_plugin
    _PLUGIN_URL = ""
    _PLUGIN_KEY = ""
    if active_plugin("acestep"):
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        _PLUGIN_URL = f"http://127.0.0.1:{port}"
        _PLUGIN_KEY = secrets.token_urlsafe(32)

def acestep_api_url() -> str:
    return _PLUGIN_URL


def acestep_api_key() -> str:
    return _PLUGIN_KEY


def acestep_model() -> str:
    return os.environ.get("AIMC_ACESTEP_MODEL", "").strip()


def acestep_configured() -> bool:
    return bool(acestep_api_url())


def acestep_reachable(timeout_sec: float = 1.5) -> bool:
    """True when AIMC_ACESTEP_API_URL responds (not merely set)."""
    base = acestep_api_url()
    if not base:
        return False
    import urllib.error
    import urllib.request

    paths = ("/docs", "/openapi.json", "/")
    for path in paths:
        try:
            req = urllib.request.Request(f"{base}{path}", method="GET")
            with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
                if 200 <= int(resp.status) < 500:
                    return True
        except (urllib.error.URLError, TimeoutError, OSError, ValueError):
            continue
    return False


def acestep_timeout_sec() -> float:
    raw = os.environ.get("AIMC_ACESTEP_TIMEOUT_SEC", "").strip()
    try:
        value = float(raw) if raw else DEFAULT_TIMEOUT_SEC
    except ValueError:
        return DEFAULT_TIMEOUT_SEC
    return max(30.0, value)


def normalize_song_format(audio_format: str | None) -> str:
    fmt = str(audio_format or "").strip().lower()
    if fmt == "m4a":
        return "aac"
    return fmt if fmt in SONG_MEDIA_TYPES else "wav"


def build_release_task_payload(
    prompt: str,
    *,
    lyrics: str = "",
    duration_sec: float | None = None,
    vocal_language: str = "",
    bpm: int | None = None,
    key_scale: str = "",
    thinking: bool = True,
    audio_format: str = "wav",
    inference_steps: int | None = None,
    guidance_scale: float | None = None,
    seed: int | None = None,
    model: str = "",
    lm_model: str = "",
    time_signature: str = "",
) -> dict[str, Any]:
    """Build the /release_task JSON body (pure; unit-testable)."""
    text = str(prompt or "").strip()
    if not text:
        raise ValueError("prompt is required")

    payload: dict[str, Any] = {
        "prompt": text,
        "lyrics": str(lyrics or ""),
        "thinking": bool(thinking),
        "audio_format": normalize_song_format(audio_format),
        "batch_size": 1,
    }
    if duration_sec is not None:
        clamped = max(_MIN_DURATION_SEC, min(float(duration_sec), _MAX_DURATION_SEC))
        payload["audio_duration"] = clamped
    if bpm is not None:
        payload["bpm"] = max(30, min(int(bpm), 300))
    language = str(vocal_language or "").strip()
    if language:
        payload["vocal_language"] = language
    key = str(key_scale or "").strip()
    if key:
        payload["key_scale"] = key
    chosen_model = str(model or "").strip() or acestep_model()
    if chosen_model:
        payload["model"] = chosen_model
    if lm_model:
        payload["lm_model_path"] = lm_model
        if os.name == "nt":
            payload["lm_backend"] = "pt"
        # Keep the learned caption/lyrics intact while generating semantic audio codes.
        payload["use_cot_caption"] = False
        payload["use_cot_language"] = False
        payload["constrained_decoding"] = True
    if time_signature:
        payload["time_signature"] = time_signature
    if inference_steps is not None:
        payload["inference_steps"] = max(1, min(int(inference_steps), 128))
    if guidance_scale is not None:
        payload["guidance_scale"] = max(0.0, min(float(guidance_scale), 20.0))
    if seed is not None and int(seed) >= 0:
        payload["seed"] = int(seed)
        payload["use_random_seed"] = False
    key_auth = acestep_api_key()
    if key_auth:
        payload["ai_token"] = key_auth
    return payload


def parse_task_submit(payload: Any) -> str:
    """Extract task_id from a /release_task response body."""
    data = payload.get("data") if isinstance(payload, dict) else None
    task_id = str((data or {}).get("task_id") or "").strip() if isinstance(data, dict) else ""
    if not task_id:
        error = payload.get("error") if isinstance(payload, dict) else None
        raise RuntimeError(f"ACE-Step task submit failed: {error or 'no task_id in response'}")
    return task_id


def parse_query_result(payload: Any) -> dict[str, Any]:
    """Extract {status, file, metas, dit_model} for the first task/result item."""
    data = payload.get("data") if isinstance(payload, dict) else None
    first = data[0] if isinstance(data, list) and data else None
    if not isinstance(first, dict):
        return {"status": 0, "file": "", "metas": {}, "dit_model": ""}

    status = int(first.get("status") or 0)
    raw_result = first.get("result")
    items: Any = raw_result
    if isinstance(raw_result, str) and raw_result.strip():
        try:
            items = json.loads(raw_result)
        except json.JSONDecodeError:
            items = None
    item = items[0] if isinstance(items, list) and items else None
    if not isinstance(item, dict):
        item = {}

    metas = item.get("metas")
    return {
        "status": status,
        "file": str(item.get("file") or ""),
        "metas": metas if isinstance(metas, dict) else {},
        "dit_model": str(item.get("dit_model") or ""),
        "lm_model": str(item.get("lm_model") or ""),
        "error": str(item.get("error") or first.get("error") or ""),
    }


def _auth_headers() -> dict[str, str]:
    key = acestep_api_key()
    return {"Authorization": f"Bearer {key}"} if key else {}


def generate_acestep_song(
    prompt: str,
    *,
    lyrics: str = "",
    duration_sec: float | None = None,
    vocal_language: str = "",
    bpm: int | None = None,
    key_scale: str = "",
    thinking: bool = True,
    audio_format: str = "wav",
    inference_steps: int | None = None,
    guidance_scale: float | None = None,
    seed: int | None = None,
    model: str = "",
    lm_model: str = "",
    time_signature: str = "",
    on_progress: Any = None,
) -> tuple[bytes, dict[str, Any]]:
    """Generate a full song via the configured ACE-Step API; returns (audio bytes, meta)."""
    if not acestep_configured():
        raise RuntimeError(
            "Activate the internal ACE-Step plugin in Plugins"
        )

    import httpx  # noqa: PLC0415 — keep import lazy like other optional stacks

    from .idle import touch_activity  # noqa: PLC0415

    base = acestep_api_url()
    fmt = normalize_song_format(audio_format)
    payload = build_release_task_payload(
        prompt,
        lyrics=lyrics,
        duration_sec=duration_sec,
        vocal_language=vocal_language,
        bpm=bpm,
        key_scale=key_scale,
        thinking=thinking,
        audio_format=fmt,
        inference_steps=inference_steps,
        guidance_scale=guidance_scale,
        seed=seed,
        model=model,
        lm_model=lm_model,
        time_signature=time_signature,
    )
    deadline = time.monotonic() + acestep_timeout_sec()

    try:
        with httpx.Client(timeout=30.0) as client:
            res = client.post(f"{base}/release_task", json=payload, headers=_auth_headers())
            res.raise_for_status()
            task_id = parse_task_submit(res.json())

            state: dict[str, Any] = {"status": 0, "file": "", "metas": {}, "dit_model": ""}
            while True:
                if time.monotonic() > deadline:
                    raise RuntimeError(
                        f"ACE-Step generation timed out after {int(acestep_timeout_sec())}s"
                    )
                poll = client.post(
                    f"{base}/query_result",
                    json={"task_id_list": [task_id]},
                    headers=_auth_headers(),
                )
                poll.raise_for_status()
                state = parse_query_result(poll.json())
                if state["status"] == 2:
                    detail = state.get("error") or "ACE-Step generation failed on the API server"
                    raise RuntimeError(detail)
                if state["status"] == 1 and state["file"]:
                    break
                touch_activity()  # long jobs must not trip the idle watchdog
                if on_progress is not None:
                    remaining = max(0.0, deadline - time.monotonic())
                    frac = 1.0 - (remaining / max(acestep_timeout_sec(), 1.0))
                    on_progress(0.15 + min(0.7, frac * 0.7), "ACE-Step generating")
                time.sleep(_POLL_INTERVAL_SEC)

            file_url = state["file"]
            audio_url = file_url if file_url.startswith("http") else f"{base}{file_url}"
            download = client.get(audio_url, headers=_auth_headers(), timeout=120.0)
            download.raise_for_status()
            audio_bytes = download.content
    except httpx.HTTPError as exc:
        raise RuntimeError(f"ACE-Step API request failed: {exc}") from exc

    if not audio_bytes:
        raise RuntimeError("ACE-Step returned an empty audio file")

    metas = state.get("metas") or {}
    meta = {
        "model": state.get("dit_model") or acestep_model() or "acestep",
        "duration_sec": metas.get("duration") or duration_sec,
        "bpm": metas.get("bpm"),
        "key_scale": metas.get("keyscale") or key_scale or "",
        "audio_format": fmt,
        "task_id": task_id,
        "mode": "acestep-song",
        "seed": seed,
        "inference_steps": inference_steps,
        "guidance_scale": guidance_scale,
        "thinking": thinking,
        "lm_model": state.get("lm_model") or "",
    }
    return audio_bytes, meta
