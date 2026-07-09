"""Vocal Embed Studio — local placement mix (guide vocal + instrumental).

Phase 1 engine: time-section ducking and vocal overlay using librosa/numpy.
Optional vocal DSP (`vocal` extra) adds guide conversion and lyrics synthesis.
"""

from __future__ import annotations

import io
import json
from typing import Any

import numpy as np

from .vocal_ml import (
    convert_guide_vocal,
    full_ml_vocal_models_available,
    ml_vocal_stack_available,
    synthesize_lyrics_vocal,
)


def synthesis_stack_available() -> bool:
    """Base placement-mix works with standard sidecar deps (librosa + soundfile)."""
    try:
        import librosa  # noqa: F401, PLC0415
        import soundfile as sf  # noqa: F401, PLC0415
    except Exception:
        return False
    return True


def _load_stereo(raw: bytes, target_sr: int = 44100) -> tuple[np.ndarray, int]:
    import librosa  # noqa: PLC0415

    y, sr = librosa.load(io.BytesIO(raw), sr=target_sr, mono=False)
    if y.ndim == 1:
        stereo = np.stack([y, y], axis=0)
    else:
        stereo = y[:2] if y.shape[0] >= 2 else np.stack([y[0], y[0]], axis=0)
    return stereo.astype(np.float32), int(sr)


def _match_length(stereo: np.ndarray, length: int) -> np.ndarray:
    channels, n = stereo.shape
    if n == length:
        return stereo
    if n > length:
        return stereo[:, :length]
    pad = np.zeros((channels, length - n), dtype=stereo.dtype)
    return np.concatenate([stereo, pad], axis=1)


def _section_envelope(duration: float, sections: list[dict[str, Any]], sample_rate: int) -> np.ndarray:
    n = max(1, int(duration * sample_rate))
    env = np.zeros(n, dtype=np.float32)
    for section in sections:
        start = float(section.get("start") or 0)
        end = float(section.get("end") or 0)
        if end <= start:
            continue
        i0 = max(0, int(start * sample_rate))
        i1 = min(n, int(end * sample_rate))
        if i1 > i0:
            env[i0:i1] = 1.0
    if not np.any(env):
        env[:] = 1.0
    return env


def _apply_hpf(stereo: np.ndarray, sample_rate: int, cutoff_hz: float = 90.0) -> np.ndarray:
    try:
        from scipy.signal import butter, sosfilt  # noqa: PLC0415
    except Exception:
        return stereo

    sos = butter(2, max(20.0, cutoff_hz) / (sample_rate / 2), btype="high", output="sos")
    out = np.zeros_like(stereo)
    for ch in range(stereo.shape[0]):
        out[ch] = sosfilt(sos, stereo[ch]).astype(np.float32)
    return out


def _normalize_peak(stereo: np.ndarray, peak: float = 0.97) -> np.ndarray:
    max_val = float(np.max(np.abs(stereo))) or 1.0
    if max_val <= peak:
        return stereo
    return (stereo * (peak / max_val)).astype(np.float32)


def _encode_wav_bytes(stereo: np.ndarray, sample_rate: int) -> bytes:
    import soundfile as sf  # noqa: PLC0415

    buf = io.BytesIO()
    sf.write(buf, stereo.T, sample_rate, subtype="PCM_16", format="WAV")
    return buf.getvalue()


def _prepare_vocal_track(
    plan: dict[str, Any],
    guide_vocal_raw: bytes | None,
    sample_rate: int,
    length: int,
) -> tuple[np.ndarray, str]:
    mode = str(plan.get("sidecarMode") or "guide-vocal-conversion")
    voice_style = str(plan.get("voiceStyle") or "")
    mix_plan = plan.get("mixPlan") or {}

    if guide_vocal_raw:
        guide, _ = _load_stereo(guide_vocal_raw, target_sr=sample_rate)
        guide = _match_length(guide, length)
        if mode == "guide-vocal-conversion":
            guide, engine = convert_guide_vocal(guide, sample_rate, voice_style, mix_plan)
            return guide, engine
        if mode == "lyrics-to-vocal-synthesis":
            guide, engine = synthesize_lyrics_vocal(
                plan,
                length,
                sample_rate,
                guide_vocal_raw=guide_vocal_raw,
            )
            return guide, engine
        return guide, "placement-mix-v1"

    if mode == "lyrics-to-vocal-synthesis":
        raise ValueError(
            "Lyrics-to-vocal mode needs DiffSinger (AIMC_DIFFSINGER_CMD/URL), "
            "vocal DSP (pip install -e ai-sidecar[vocal]), or a guide vocal file.",
        )
    raise ValueError("Attach a guide vocal WAV/MP3 for local placement-mix synthesis.")


def synthesize_vocal_embed_mix(
    plan: dict[str, Any],
    instrumental_raw: bytes,
    guide_vocal_raw: bytes | None = None,
) -> tuple[bytes, dict[str, Any]]:
    """Return mixed WAV bytes and metadata."""
    if not synthesis_stack_available():
        raise RuntimeError("vocal synthesis deps missing — reinstall ai-sidecar base deps")

    mix_plan = plan.get("mixPlan") or {}
    duck_db = float(mix_plan.get("instrumentalDuckDb") or -4)
    duck_gain = 10 ** (duck_db / 20.0)
    hpf_hz = float(mix_plan.get("vocalHighPassHz") or 90)

    inst, sr = _load_stereo(instrumental_raw)
    length = inst.shape[1]
    inst = _match_length(inst, length)

    guide, vocal_engine = _prepare_vocal_track(plan, guide_vocal_raw, sr, length)
    guide = _apply_hpf(guide, sr, hpf_hz)

    duration = length / sr
    sections = plan.get("sections") or []
    if not isinstance(sections, list):
        sections = []
    envelope = _section_envelope(duration, sections, sr)

    duck = 1.0 + (duck_gain - 1.0) * envelope
    inst_ducked = inst * duck[np.newaxis, :]
    mixed = inst_ducked + guide * 0.92
    mixed = _normalize_peak(mixed)

    engine = vocal_engine if vocal_engine != "placement-mix-v1" else "placement-mix-v1"
    meta = {
        "engine": engine,
        "mode": str(plan.get("sidecarMode") or "guide-vocal-conversion"),
        "sample_rate": sr,
        "duration_sec": duration,
        "section_count": len(sections),
        "vocal_dsp": ml_vocal_stack_available(),
        "vocal_models": full_ml_vocal_models_available(),
    }
    return _encode_wav_bytes(mixed, sr), meta


def parse_plan_envelope(raw: str | bytes) -> dict[str, Any]:
    data = json.loads(raw) if isinstance(raw, (str, bytes)) else raw
    if isinstance(data, str):
        data = json.loads(data)
    if not isinstance(data, dict):
        raise ValueError("plan envelope must be a JSON object")
    if data.get("kind") != "vocal_embed_plan":
        raise ValueError("expected kind vocal_embed_plan")
    plan = data.get("plan")
    if not isinstance(plan, dict):
        raise ValueError("missing plan object")
    if plan.get("stage") != "ready":
        raise ValueError("plan must be ready before synthesis")
    openvpi_ds = data.get("openvpiDs")
    if isinstance(openvpi_ds, dict) and openvpi_ds.get("segments"):
        plan = {**plan, "openvpiDs": openvpi_ds}
    return plan
