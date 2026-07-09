"""OpenVPI DiffSinger integration for Vocal Embed Studio.

Requires a local clone of https://github.com/openvpi/DiffSinger with checkpoints.
Configure via ai-sidecar/.env.vocal or process environment.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

import numpy as np

_NOTE_NAMES = ("C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B")
_MAJOR_SCALE = (0, 2, 4, 5, 7, 9, 11)


def openvpi_root() -> Path | None:
    raw = os.environ.get("AIMC_DIFFSINGER_ROOT", "").strip()
    if not raw:
        return None
    root = Path(raw).expanduser()
    if (root / "scripts" / "infer.py").is_file():
        return root
    return None


def openvpi_acoustic_exp() -> str | None:
    exp = os.environ.get("AIMC_DIFFSINGER_ACOUSTIC_EXP", "").strip()
    return exp or None


def openvpi_variance_exp() -> str | None:
    exp = os.environ.get("AIMC_DIFFSINGER_VAR_EXP", "").strip()
    return exp or None


def openvpi_configured() -> bool:
    return openvpi_root() is not None and openvpi_acoustic_exp() is not None


def openvpi_ready() -> bool:
    root = openvpi_root()
    if not root or not openvpi_acoustic_exp():
        return False
    ckpt_root = root / "checkpoints"
    if not ckpt_root.is_dir():
        return False
    ac_exp = openvpi_acoustic_exp() or ""
    if not any(p.name == ac_exp or p.name.startswith(ac_exp) for p in ckpt_root.iterdir() if p.is_dir()):
        return False
    var_exp = openvpi_variance_exp()
    if var_exp and not any(p.name == var_exp or p.name.startswith(var_exp) for p in ckpt_root.iterdir() if p.is_dir()):
        return False
    return True


def openvpi_status() -> dict[str, Any]:
    root = openvpi_root()
    return {
        "root": str(root) if root else None,
        "acoustic_exp": openvpi_acoustic_exp(),
        "variance_exp": openvpi_variance_exp(),
        "python": os.environ.get("AIMC_DIFFSINGER_PYTHON", "").strip() or None,
        "speaker": os.environ.get("AIMC_DIFFSINGER_SPK", "").strip() or None,
        "language": os.environ.get("AIMC_DIFFSINGER_LANG", "").strip() or None,
        "configured": openvpi_configured(),
        "ready": openvpi_ready(),
    }


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


def _root_midi_from_key(key: str) -> int:
    lower = str(key or "C").lower()
    roots = {
        "c": 60,
        "c#": 61,
        "db": 61,
        "d": 62,
        "d#": 63,
        "eb": 63,
        "e": 64,
        "f": 65,
        "f#": 66,
        "gb": 66,
        "g": 67,
        "g#": 68,
        "ab": 68,
        "a": 69,
        "a#": 70,
        "bb": 70,
        "b": 71,
    }
    for name, midi in roots.items():
        if lower.startswith(name):
            return midi
    return 60


def _midi_to_note(midi: int) -> str:
    midi = max(36, min(84, int(midi)))
    return f"{_NOTE_NAMES[midi % 12]}{midi // 12 - 1}"


def build_ds_segments_from_plan(plan: dict[str, Any]) -> list[dict[str, Any]]:
    """Build OpenVPI DS segments with note timing from vocal embed section map."""
    sections = plan.get("sections") or []
    if not isinstance(sections, list):
        sections = []
    lyrics = str(plan.get("lyrics") or "")
    root_midi = _root_midi_from_key(str(plan.get("key") or "C"))

    segments: list[dict[str, Any]] = []
    word_index = 0
    for section in sections:
        if not isinstance(section, dict):
            continue
        start = float(section.get("start") or 0)
        end = float(section.get("end") or 0)
        if end <= start:
            continue
        words = _section_words(section, lyrics)
        if not words:
            continue

        duration = end - start
        slot = max(0.12, duration / max(len(words), 1))
        note_seq: list[str] = []
        note_dur: list[str] = []
        note_slur: list[str] = []
        text_tokens: list[str] = []

        cursor = 0.0
        for word in words:
            if cursor >= duration:
                break
            note_dur_val = min(slot, duration - cursor)
            degree = _MAJOR_SCALE[word_index % len(_MAJOR_SCALE)]
            octave = (word_index // len(_MAJOR_SCALE)) % 2
            midi = root_midi + degree + octave * 12
            note_seq.append(_midi_to_note(midi))
            note_dur.append(f"{note_dur_val:.4f}")
            note_slur.append("0")
            text_tokens.append(word)
            cursor += note_dur_val
            word_index += 1

        if not note_seq:
            continue

        segments.append(
            {
                "offset": round(start, 4),
                "text": " ".join(text_tokens),
                "note_seq": " ".join(note_seq),
                "note_dur": " ".join(note_dur),
                "note_slur": " ".join(note_slur),
            },
        )

    if segments:
        return segments

    words = _singable_words(lyrics) or ["la"]
    bpm = _parse_bpm(plan)
    beat = 60.0 / max(60.0, bpm)
    note_seq = []
    note_dur = []
    note_slur = []
    for i, word in enumerate(words[:16]):
        degree = _MAJOR_SCALE[i % len(_MAJOR_SCALE)]
        note_seq.append(_midi_to_note(root_midi + degree))
        note_dur.append(f"{beat * 0.45:.4f}")
        note_slur.append("0")
    return [
        {
            "offset": 0.0,
            "text": " ".join(words[:16]),
            "note_seq": " ".join(note_seq),
            "note_dur": " ".join(note_dur),
            "note_slur": " ".join(note_slur),
        },
    ]


def _segments_need_variance(segments: list[dict[str, Any]]) -> bool:
    for segment in segments:
        if segment.get("f0_seq"):
            continue
        if segment.get("ph_seq"):
            continue
        if segment.get("note_seq"):
            return True
    return True


def _python_executable() -> str:
    return os.environ.get("AIMC_DIFFSINGER_PYTHON", "").strip() or sys.executable


def _run_infer(
    subcommand: str,
    ds_path: Path,
    out_dir: Path,
    exp: str,
    *,
    title: str | None = None,
) -> None:
    root = openvpi_root()
    if not root:
        raise RuntimeError("AIMC_DIFFSINGER_ROOT is not configured")

    infer_py = root / "scripts" / "infer.py"
    cmd = [
        _python_executable(),
        str(infer_py),
        subcommand,
        str(ds_path),
        "--exp",
        exp,
        "--out",
        str(out_dir),
    ]
    if title:
        cmd.extend(["--title", title])
    spk = os.environ.get("AIMC_DIFFSINGER_SPK", "").strip()
    if spk:
        cmd.extend(["--spk", spk])
    lang = os.environ.get("AIMC_DIFFSINGER_LANG", "").strip()
    if lang:
        cmd.extend(["--lang", lang])
    key = os.environ.get("AIMC_DIFFSINGER_KEY", "").strip()
    if key:
        cmd.extend(["--key", key])

    env = os.environ.copy()
    env["PYTHONPATH"] = str(root) + os.pathsep + env.get("PYTHONPATH", "")
    subprocess.run(cmd, cwd=str(root), env=env, check=True, timeout=900)


def _find_variance_ds(work_dir: Path, stem: str) -> Path:
    candidate = work_dir / f"{stem}_variance.ds"
    if candidate.is_file():
        return candidate
    matches = sorted(work_dir.glob(f"{stem}*variance*.ds"), key=lambda p: p.stat().st_mtime, reverse=True)
    if matches:
        return matches[0]
    matches = sorted(work_dir.glob("*.ds"), key=lambda p: p.stat().st_mtime, reverse=True)
    for path in matches:
        if path.stem != stem:
            return path
    raise RuntimeError("OpenVPI variance step did not produce an updated .ds file")


def _find_output_wav(work_dir: Path, title: str) -> Path:
    direct = work_dir / f"{title}.wav"
    if direct.is_file():
        return direct
    matches = sorted(work_dir.glob(f"{title}*.wav"), key=lambda p: p.stat().st_mtime, reverse=True)
    if matches:
        return matches[0]
    raise RuntimeError("OpenVPI acoustic step did not produce a WAV file")


def synthesize_with_openvpi(plan: dict[str, Any], length: int, sample_rate: int) -> np.ndarray:
    """Run OpenVPI variance (optional) + acoustic inference and return stereo vocal bed."""
    if not openvpi_configured():
        raise RuntimeError("OpenVPI DiffSinger is not configured")

    segments = build_ds_segments_from_plan(plan)
    if _segments_need_variance(segments) and not openvpi_variance_exp():
        raise RuntimeError(
            "OpenVPI note-based DS requires AIMC_DIFFSINGER_VAR_EXP (variance model) "
            "or a pre-filled DS with ph_seq/f0_seq.",
        )

    with tempfile.TemporaryDirectory(prefix="aimc-openvpi-") as tmp:
        work_dir = Path(tmp)
        ds_path = work_dir / "vocal_embed.ds"
        ds_path.write_text(json.dumps(segments, ensure_ascii=False), encoding="utf-8")

        current_ds = ds_path
        title = "vocal_embed"
        var_exp = openvpi_variance_exp()
        if var_exp and _segments_need_variance(segments):
            _run_infer("variance", current_ds, work_dir, var_exp)
            current_ds = _find_variance_ds(work_dir, title)

        ac_exp = openvpi_acoustic_exp()
        if not ac_exp:
            raise RuntimeError("AIMC_DIFFSINGER_ACOUSTIC_EXP is required")
        _run_infer("acoustic", current_ds, work_dir, ac_exp, title=title)
        wav_path = _find_output_wav(work_dir, title)

        import librosa  # noqa: PLC0415

        mono, _ = librosa.load(str(wav_path), sr=sample_rate, mono=True)
        mono = mono.astype(np.float32)
        if mono.shape[0] < length:
            pad = np.zeros(length - mono.shape[0], dtype=np.float32)
            mono = np.concatenate([mono, pad])
        mono = mono[:length]
        peak = float(np.max(np.abs(mono))) or 1.0
        if peak > 0.98:
            mono = (mono * (0.95 / peak)).astype(np.float32)
        return np.stack([mono, mono], axis=0)
