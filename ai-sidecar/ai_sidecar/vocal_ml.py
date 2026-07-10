"""Vocal Embed Studio — optional DSP vocal conversion and lyrics synthesis (v1).

Uses librosa pitch/formant-style shaping when scipy is installed (`vocal` extra).
Full RVC/DiffSinger model weights use optional `vocal-ml` extra plus env configuration.
"""

from __future__ import annotations

import re
from typing import Any

import numpy as np

from .vocal_ml_models import (
    convert_guide_with_rvc,
    diffsinger_configured,
    full_ml_vocal_models_available,
    rvc_ready,
    synthesize_with_diffsinger,
)
from .diffsinger_openvpi import openvpi_configured


def _base_audio_stack_available() -> bool:
    try:
        import librosa  # noqa: F401, PLC0415
        import soundfile as sf  # noqa: F401, PLC0415
    except Exception:
        return False
    return True


_PITCH_HINTS: tuple[tuple[str, float], ...] = (
    ("bass", -5.0),
    ("baritone", -2.5),
    ("tenor", 1.5),
    ("alto", 3.0),
    ("soprano", 5.0),
    ("falsetto", 6.0),
    ("whisper", -1.0),
    ("deep", -3.0),
    ("high", 3.5),
)


def ml_vocal_stack_available() -> bool:
    """True when scipy + librosa vocal DSP stack is installed (`vocal` extra)."""
    if not _base_audio_stack_available():
        return False
    try:
        from scipy.signal import butter, sosfilt  # noqa: F401, PLC0415
    except Exception:
        return False
    return True


def infer_pitch_shift_semitones(voice_style: str) -> float:
    lower = str(voice_style or "").lower()
    for term, semi in _PITCH_HINTS:
        if term in lower:
            return semi
    return 0.0


def _parse_bpm(plan: dict[str, Any]) -> float:
    match = re.search(r"(\d+(?:\.\d+)?)", str(plan.get("bpm") or "120"))
    return float(match.group(1)) if match else 120.0


def _singable_words(text: str) -> list[str]:
    words: list[str] = []
    for line in str(text or "").splitlines():
        line = line.strip()
        if not line or (line.startswith("[") and line.endswith("]")):
            continue
        words.extend(part for part in re.split(r"\s+", line) if part)
    return words


def _apply_presence_boost(stereo: np.ndarray, sample_rate: int) -> np.ndarray:
    try:
        from scipy.signal import butter, sosfilt  # noqa: PLC0415
    except Exception:
        return stereo

    low = 1800.0 / (sample_rate / 2)
    high = min(0.99, 5200.0 / (sample_rate / 2))
    if low >= high:
        return stereo
    sos = butter(2, [low, high], btype="band", output="sos")
    wet = np.zeros_like(stereo)
    for ch in range(stereo.shape[0]):
        wet[ch] = sosfilt(sos, stereo[ch]).astype(np.float32)
    return (stereo * 0.72 + wet * 0.42).astype(np.float32)


def _pitch_shift_mono(mono: np.ndarray, sample_rate: int, semitones: float) -> np.ndarray:
    if abs(semitones) < 0.05:
        return mono
    import librosa  # noqa: PLC0415

    shifted = librosa.effects.pitch_shift(mono, sr=sample_rate, n_steps=semitones)
    if shifted.shape[0] < mono.shape[0]:
        pad = np.zeros(mono.shape[0] - shifted.shape[0], dtype=shifted.dtype)
        shifted = np.concatenate([shifted, pad])
    return shifted[: mono.shape[0]].astype(np.float32)


def convert_guide_vocal(
    stereo: np.ndarray,
    sample_rate: int,
    voice_style: str,
    mix_plan: dict[str, Any] | None = None,
) -> tuple[np.ndarray, str]:
    """Apply RVC or lightweight DSP conversion to a guide vocal."""
    _ = mix_plan
    semi = infer_pitch_shift_semitones(voice_style)

    if rvc_ready():
        try:
            return convert_guide_with_rvc(stereo, sample_rate, semi), "rvc-conversion-v1"
        except Exception:
            pass

    if not ml_vocal_stack_available():
        return stereo, "placement-mix-v1"

    out = np.zeros_like(stereo)
    for ch in range(stereo.shape[0]):
        out[ch] = _pitch_shift_mono(stereo[ch], sample_rate, semi)
    return _apply_presence_boost(out, sample_rate), "guide-conversion-v1"


def _section_words(section: dict[str, Any], fallback_lyrics: str) -> list[str]:
    text = str(section.get("text") or "").strip()
    words = _singable_words(text)
    if words:
        return words
    line_count = int(section.get("lineCount") or 0)
    if line_count > 0:
        all_words = _singable_words(fallback_lyrics)
        if all_words:
            per = max(1, len(all_words) // max(line_count, 1))
            return all_words[: max(1, line_count * per)]
    return []


def _note_hz(plan: dict[str, Any], word_index: int) -> float:
    key = str(plan.get("key") or "C").lower()
    root = {
        "c": 261.63,
        "c#": 277.18,
        "d": 293.66,
        "d#": 311.13,
        "e": 329.63,
        "f": 349.23,
        "f#": 369.99,
        "g": 392.0,
        "g#": 415.3,
        "a": 440.0,
        "a#": 466.16,
        "b": 493.88,
    }
    base = 220.0
    for name, hz in root.items():
        if key.startswith(name):
            base = hz * 0.5
            break
    scale = [0, 2, 4, 5, 7, 9, 11]
    degree = scale[word_index % len(scale)]
    octave = (word_index // len(scale)) % 2
    return base * (2 ** ((degree + octave * 12) / 12.0))


def synthesize_lyrics_vocal(
    plan: dict[str, Any],
    length: int,
    sample_rate: int,
    *,
    guide_vocal_raw: bytes | None = None,
) -> tuple[np.ndarray, str]:
    """Build a vocal guide from lyrics, preferring DiffSinger when configured."""
    if diffsinger_configured():
        try:
            engine = "openvpi-diffsinger-v1" if openvpi_configured() else "diffsinger-v1"
            return (
                synthesize_with_diffsinger(
                    plan,
                    length,
                    sample_rate,
                    guide_vocal_raw=guide_vocal_raw,
                ),
                engine,
            )
        except Exception:
            pass

    if not ml_vocal_stack_available():
        raise RuntimeError("vocal DSP stack unavailable — install ai-sidecar[vocal]")

    sections = plan.get("sections") or []
    if not isinstance(sections, list):
        sections = []
    lyrics = str(plan.get("lyrics") or "")
    bpm = _parse_bpm(plan)
    beat_sec = 60.0 / max(60.0, bpm)

    stereo = np.zeros((2, length), dtype=np.float32)
    word_index = 0
    wrote = False

    for section in sections:
        if not isinstance(section, dict):
            continue
        start = int(float(section.get("start") or 0) * sample_rate)
        end = int(float(section.get("end") or 0) * sample_rate)
        if end <= start:
            continue
        words = _section_words(section, lyrics)
        if not words:
            continue

        seg_len = end - start
        slot = max(int(sample_rate * beat_sec * 0.45), int(seg_len / max(len(words), 1)))
        cursor = start
        for word in words:
            if cursor >= end:
                break
            w1 = min(end, cursor + slot)
            if w1 <= cursor:
                break
            n = w1 - cursor
            if n <= 1:
                continue
            t = np.arange(n, dtype=np.float32) / sample_rate
            freq = _note_hz(plan, word_index)
            if not np.isfinite(freq) or freq <= 0:
                continue
            env = np.sin(np.pi * np.linspace(0, 1, n, dtype=np.float32)) ** 0.65
            tone = (0.18 * np.sin(2 * np.pi * freq * t) * env).astype(np.float32)
            stereo[0, cursor:w1] += tone
            stereo[1, cursor:w1] += tone
            cursor = min(end, cursor + slot)
            word_index += 1
            wrote = True

    if not wrote:
        raise ValueError("Could not derive lyric timing from plan sections — add lyrics with section tags.")

    peak = float(np.nanmax(np.abs(stereo))) or 1.0
    if peak > 0.98:
        stereo = (stereo * (0.95 / peak)).astype(np.float32)
    return _apply_presence_boost(np.nan_to_num(stereo, nan=0.0), sample_rate), "lyrics-synth-v1"
