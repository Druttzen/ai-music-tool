"""ACE-Step 1.5 full-song generation via a locally run ACE-Step API server.

ACE-Step 1.5 (MIT-licensed weights) needs Python 3.11+ and its own model
runtime, so it is not a pip extra of this sidecar. Run its API server
separately (`uv run acestep-api`, launch script, or portable package) and
point the sidecar at it:

    AIMC_ACESTEP_API_URL=http://127.0.0.1:8001
    AIMC_ACESTEP_API_KEY=...                 # only when ACESTEP_API_KEY is set
    AIMC_ACESTEP_MODEL=acestep-v15-turbo     # optional DiT model override
    AIMC_ACESTEP_TIMEOUT_SEC=600             # optional poll budget

Protocol (see ACE-Step docs/en/API.md): POST /release_task -> task_id,
poll POST /query_result until status 1 (done) / 2 (failed), then download
the audio from GET /v1/audio?path=... — see docs/acestep.md in this repo.
"""

from __future__ import annotations

import json
import os
import time
from typing import Any

DEFAULT_TIMEOUT_SEC = 600.0
_POLL_INTERVAL_SEC = 2.0
_MIN_DURATION_SEC = 10.0
_MAX_DURATION_SEC = 600.0

SONG_MEDIA_TYPES = {
    "wav": "audio/wav",
    "mp3": "audio/mpeg",
    "flac": "audio/flac",
}


def acestep_api_url() -> str:
    return os.environ.get("AIMC_ACESTEP_API_URL", "").strip().rstrip("/")


def acestep_api_key() -> str:
    return os.environ.get("AIMC_ACESTEP_API_KEY", "").strip()


def acestep_model() -> str:
    return os.environ.get("AIMC_ACESTEP_MODEL", "").strip()


def acestep_configured() -> bool:
    return bool(acestep_api_url())


def acestep_timeout_sec() -> float:
    raw = os.environ.get("AIMC_ACESTEP_TIMEOUT_SEC", "").strip()
    try:
        value = float(raw) if raw else DEFAULT_TIMEOUT_SEC
    except ValueError:
        return DEFAULT_TIMEOUT_SEC
    return max(30.0, value)


def normalize_song_format(audio_format: str | None) -> str:
    fmt = str(audio_format or "").strip().lower()
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
    model = acestep_model()
    if model:
        payload["model"] = model
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
) -> tuple[bytes, dict[str, Any]]:
    """Generate a full song via the configured ACE-Step API; returns (audio bytes, meta)."""
    if not acestep_configured():
        raise RuntimeError(
            "ACE-Step not configured — set AIMC_ACESTEP_API_URL (see docs/acestep.md)"
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
                    raise RuntimeError("ACE-Step generation failed on the API server")
                if state["status"] == 1 and state["file"]:
                    break
                touch_activity()  # long jobs must not trip the idle watchdog
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
    }
    return audio_bytes, meta
