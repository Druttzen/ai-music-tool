"""Optional guide-vocal alignment for DiffSinger DS timing.

Uses Montreal Forced Aligner when AIMC_MFA_MODEL is configured; otherwise falls
back to librosa onset/energy heuristics on the guide vocal mono track.
"""

from __future__ import annotations

import os
import re
import subprocess
import tempfile
from pathlib import Path
from typing import Any

import numpy as np


def mfa_configured() -> bool:
    model = os.environ.get("AIMC_MFA_MODEL", "").strip()
    dictionary = os.environ.get("AIMC_MFA_DICT", "").strip()
    return bool(model and dictionary)


def _clean_word(token: str) -> str:
    return re.sub(r"[^a-z0-9']+", "", str(token or "").lower())


def _energy_onsets(mono: np.ndarray, sample_rate: int) -> np.ndarray:
    try:
        import librosa  # noqa: PLC0415
    except Exception:
        return np.array([], dtype=np.float32)

    hop = max(1, int(sample_rate * 0.01))
    frame = max(hop * 2, int(sample_rate * 0.04))
    rms = librosa.feature.rms(y=mono, frame_length=frame, hop_length=hop)[0]
    if rms.size < 3:
        return np.array([], dtype=np.float32)
    threshold = float(np.percentile(rms, 65))
    peaks: list[float] = []
    for i in range(1, rms.size - 1):
        if rms[i] >= threshold and rms[i] >= rms[i - 1] and rms[i] >= rms[i + 1]:
            peaks.append(i * hop / sample_rate)
    return np.asarray(peaks, dtype=np.float32)


def _heuristic_word_starts(
    mono: np.ndarray,
    sample_rate: int,
    words: list[str],
    *,
    section_start: float,
    section_end: float,
) -> list[float]:
    if not words:
        return []

    duration = max(0.05, section_end - section_start)
    onsets = _energy_onsets(mono, sample_rate)
    if onsets.size >= len(words):
        return [section_start + float(t) for t in onsets[: len(words)]]

    slot = duration / max(len(words), 1)
    return [section_start + i * slot for i in range(len(words))]


def _parse_textgrid_starts(textgrid_path: Path, words: list[str]) -> list[float] | None:
    try:
        text = textgrid_path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return None

    intervals: list[tuple[float, str]] = []
    for match in re.finditer(
        r"xmin\s*=\s*([\d.]+)\s*\n\s*xmax\s*=\s*([\d.]+)\s*\n\s*text\s*=\s*\"([^\"]*)\"",
        text,
        flags=re.MULTILINE,
    ):
        start = float(match.group(1))
        label = _clean_word(match.group(3))
        if label:
            intervals.append((start, label))

    if not intervals:
        return None

    targets = [_clean_word(w) for w in words]
    starts: list[float] = []
    cursor = 0
    for target in targets:
        found = None
        for i in range(cursor, len(intervals)):
            if intervals[i][1] == target:
                found = intervals[i][0]
                cursor = i + 1
                break
        if found is None:
            return None
        starts.append(found)
    return starts


def _align_with_mfa(
    mono: np.ndarray,
    sample_rate: int,
    transcript: str,
    words: list[str],
) -> list[float] | None:
    if not mfa_configured():
        return None

    mfa_bin = os.environ.get("AIMC_MFA_BIN", "mfa").strip() or "mfa"
    model = os.environ.get("AIMC_MFA_MODEL", "").strip()
    dictionary = os.environ.get("AIMC_MFA_DICT", "").strip()
    if not model or not dictionary:
        return None

    try:
        import soundfile as sf  # noqa: PLC0415
    except Exception:
        return None

    with tempfile.TemporaryDirectory(prefix="aimc-mfa-") as tmp:
        work = Path(tmp)
        wav_path = work / "guide.wav"
        lab_path = work / "guide.lab"
        out_dir = work / "align"
        out_dir.mkdir(parents=True, exist_ok=True)
        sf.write(str(wav_path), mono.astype(np.float32), sample_rate, subtype="PCM_16")
        lab_path.write_text(transcript.strip() + "\n", encoding="utf-8")

        cmd = [
            mfa_bin,
            "align",
            str(wav_path.parent),
            dictionary,
            model,
            str(out_dir),
            "--clean",
            "--overwrite",
        ]
        try:
            subprocess.run(cmd, check=True, capture_output=True, timeout=300)
        except Exception:
            return None

        textgrids = list(out_dir.glob("*.TextGrid")) + list(out_dir.glob("**/*.TextGrid"))
        for tg in textgrids:
            starts = _parse_textgrid_starts(tg, words)
            if starts:
                return starts
    return None


def align_section_words(
    guide_mono: np.ndarray,
    sample_rate: int,
    words: list[str],
    *,
    section_start: float,
    section_end: float,
) -> list[dict[str, Any]]:
    """Return [{word, start, end}] for a vocal section."""
    if not words:
        return []

    i0 = max(0, int(section_start * sample_rate))
    i1 = min(guide_mono.shape[0], int(section_end * sample_rate))
    segment = guide_mono[i0:i1] if i1 > i0 else guide_mono

    transcript = " ".join(words)
    starts = _align_with_mfa(segment, sample_rate, transcript, words)
    if starts is None:
        starts = _heuristic_word_starts(
            segment,
            sample_rate,
            words,
            section_start=section_start,
            section_end=section_end,
        )

    aligned: list[dict[str, Any]] = []
    for i, word in enumerate(words):
        start = float(starts[i]) if i < len(starts) else section_start
        if i + 1 < len(starts):
            end = float(starts[i + 1])
        elif i + 1 < len(words) and i + 1 < len(starts):
            end = float(starts[i + 1])
        else:
            end = section_end
        if end <= start:
            end = min(section_end, start + 0.12)
        aligned.append({"word": word, "start": start, "end": end})
    return aligned


def align_plan_with_guide(
    plan: dict[str, Any],
    guide_mono: np.ndarray,
    sample_rate: int,
) -> dict[str, Any]:
    """Attach per-section word timings derived from a guide vocal."""
    sections = plan.get("sections") or []
    if not isinstance(sections, list) or guide_mono.size == 0:
        return plan

    lyrics = str(plan.get("lyrics") or "")
    enriched: list[dict[str, Any]] = []
    for section in sections:
        if not isinstance(section, dict):
            continue
        start = float(section.get("start") or 0)
        end = float(section.get("end") or 0)
        if end <= start:
            enriched.append(section)
            continue

        text = str(section.get("text") or "").strip()
        words = [w for w in re.split(r"\s+", text) if w] if text else []
        if not words and lyrics:
            words = [w for w in re.split(r"\s+", lyrics) if w][: max(1, int(section.get("lineCount") or 4))]

        if not words:
            enriched.append(section)
            continue

        aligned = align_section_words(
            guide_mono,
            sample_rate,
            words,
            section_start=start,
            section_end=end,
        )
        copy = dict(section)
        copy["alignedWords"] = aligned
        enriched.append(copy)

    out = dict(plan)
    out["sections"] = enriched
    return out
