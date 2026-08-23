"""Optional lyrics-to-speech via transformers TTS (MMS).

RVC/DiffSinger stay primary. This path is ready when transformers+torch import.
Probe is import-only; first use may download weights into HF_HOME.
Set AIMC_VOCAL_TTS_OFF=1 to skip (tests).
"""

from __future__ import annotations

import os
from typing import Any

import numpy as np

VOCAL_TTS_OFF_ENV = "AIMC_VOCAL_TTS_OFF"
DEFAULT_VOCAL_MODEL = "facebook/mms-tts-eng"
MAX_LYRICS_CHARS = 400

_pipeline = None


def vocal_tts_engine_ready() -> bool:
    if os.environ.get(VOCAL_TTS_OFF_ENV) == "1":
        return False
    try:
        import torch  # noqa: F401, PLC0415
        import transformers  # noqa: F401, PLC0415
    except Exception:
        return False
    return True


def tts_pipeline_task() -> str:
    try:
        from transformers.pipelines import check_task  # noqa: PLC0415
    except Exception:
        return "text-to-speech"
    for task in ("text-to-speech", "text-to-audio"):
        try:
            check_task(task)
            return task
        except Exception:
            continue
    return "text-to-speech"


def _lyrics_from_plan(plan: dict[str, Any]) -> str:
    lyrics = str(plan.get("lyrics") or "").strip()
    if lyrics:
        return lyrics[:MAX_LYRICS_CHARS]
    parts: list[str] = []
    for section in plan.get("sections") or []:
        if isinstance(section, dict):
            text = str(section.get("text") or section.get("lyrics") or "").strip()
            if text:
                parts.append(text)
    return "\n".join(parts).strip()[:MAX_LYRICS_CHARS]


def _to_stereo(samples: list[float], src_rate: int, length: int, sample_rate: int) -> np.ndarray:
    mono = np.asarray(samples, dtype=np.float32)
    if src_rate != sample_rate and src_rate > 0 and mono.size:
        duration = mono.size / float(src_rate)
        target_n = max(1, int(round(duration * sample_rate)))
        x_old = np.linspace(0.0, 1.0, mono.size, dtype=np.float32)
        x_new = np.linspace(0.0, 1.0, target_n, dtype=np.float32)
        mono = np.interp(x_new, x_old, mono).astype(np.float32)
    if mono.size < length:
        mono = np.pad(mono, (0, length - mono.size))
    elif mono.size > length:
        mono = mono[:length]
    peak = float(np.max(np.abs(mono))) if mono.size else 0.0
    if peak > 1.0:
        mono = (mono / peak).astype(np.float32)
    return np.stack([mono, mono], axis=0)


def try_transformers_tts(
    plan: dict[str, Any],
    length: int,
    sample_rate: int,
) -> tuple[np.ndarray, str] | None:
    """Return stereo vocal audio or None. Never raises."""
    try:
        if not vocal_tts_engine_ready():
            return None
        lyrics = _lyrics_from_plan(plan)
        if not lyrics:
            return None
        global _pipeline
        if _pipeline is None:
            from transformers import pipeline  # noqa: PLC0415

            model_id = os.environ.get("AIMC_VOCAL_TTS_MODEL") or DEFAULT_VOCAL_MODEL
            _pipeline = pipeline(tts_pipeline_task(), model=model_id)
        raw = _pipeline(lyrics)
        if not isinstance(raw, dict):
            return None
        audio = raw.get("audio")
        rate = int(raw.get("sampling_rate") or raw.get("sample_rate") or 16000)
        if hasattr(audio, "detach"):
            audio = audio.detach().cpu().numpy()
        if hasattr(audio, "tolist"):
            data = audio.tolist()
        elif isinstance(audio, (list, tuple)):
            data = list(audio)
        else:
            return None
        while isinstance(data, list) and data and isinstance(data[0], (list, tuple)):
            data = list(data[0])
        samples = [float(x) for x in data]
        if not samples:
            return None
        return _to_stereo(samples, rate, length, sample_rate), "transformers-tts-v1"
    except Exception:
        return None
