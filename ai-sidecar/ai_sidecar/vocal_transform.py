"""Region vocal transform: separate → transform regions → remix / acapella.

Transforms selected time ranges on the vocal stem of an existing mix
(e.g. a Suno export). Modes:

- ``rvc`` — RVC voice conversion (requires vocal-rvc extra or AIMC_RVC_API_URL)
- ``pitch`` — pitch shift in semitones (librosa; base sidecar)
- ``robot`` — amplitude × carrier ring-mod style (librosa; base sidecar)
- ``formant`` — crude formant shift via pitch+time stretch (librosa; base sidecar)

Returns remix WAV (new vocals + instrumental) and/or acapella WAV.
"""

from __future__ import annotations

import io
import os
import tempfile
from typing import Any

import numpy as np

from .jobs import JOBS, JobContext, register
from .stems_separate import separate_audio, stems_available

_CROSSFADE_SEC = 0.04
_MODES = frozenset({"rvc", "pitch", "robot", "formant"})
_OUTPUTS = frozenset({"remix", "vocals", "both"})


def normalize_mode(mode: str | None) -> str:
    value = str(mode or "pitch").strip().lower()
    return value if value in _MODES else "pitch"


def normalize_output(output: str | None) -> str:
    value = str(output or "both").strip().lower()
    return value if value in _OUTPUTS else "both"


def parse_regions(raw: Any) -> list[tuple[float, float]]:
    """Parse [{start_sec, end_sec}, ...] into sorted non-empty ranges."""
    if not isinstance(raw, list):
        return []
    regions: list[tuple[float, float]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        try:
            start = float(item.get("start_sec", item.get("start", 0)))
            end = float(item.get("end_sec", item.get("end", 0)))
        except (TypeError, ValueError):
            continue
        if end <= start:
            continue
        regions.append((max(0.0, start), end))
    regions.sort(key=lambda r: r[0])
    return regions


def vocal_transform_available(*, mode: str | None = None) -> bool:
    resolved = normalize_mode(mode)
    if resolved == "rvc":
        from .vocal_ml_models import rvc_ready

        return stems_available() and rvc_ready()
    # DSP modes only need stems + base librosa (always present with sidecar).
    return stems_available()


def _write_wav_bytes(audio: np.ndarray, sample_rate: int) -> bytes:
    import soundfile as sf

    buf = io.BytesIO()
    if audio.ndim == 1:
        data = audio
    else:
        data = audio.T  # (channels, samples) -> (samples, channels)
    peak = float(np.max(np.abs(data))) or 1.0
    if peak > 0.98:
        data = (data * (0.95 / peak)).astype(np.float32)
    else:
        data = np.asarray(data, dtype=np.float32)
    sf.write(buf, data, sample_rate, subtype="PCM_16", format="WAV")
    return buf.getvalue()


def _load_wav_mono(path: str) -> tuple[np.ndarray, int]:
    import librosa

    y, sr = librosa.load(path, sr=None, mono=True)
    return np.asarray(y, dtype=np.float32), int(sr)


def _load_wav_stereo(path: str) -> tuple[np.ndarray, int]:
    import librosa

    y, sr = librosa.load(path, sr=None, mono=False)
    arr = np.asarray(y, dtype=np.float32)
    if arr.ndim == 1:
        arr = np.stack([arr, arr], axis=0)
    return arr, int(sr)


def _apply_crossfade(original: np.ndarray, transformed: np.ndarray, start: int, end: int, fade: int) -> None:
    """In-place splice transformed[start:end] into original with edge fades."""
    length = original.shape[0]
    start = max(0, min(start, length))
    end = max(start, min(end, length))
    if end <= start:
        return
    segment = transformed[start:end]
    fade = max(0, min(fade, (end - start) // 2))
    if fade > 0:
        ramp = np.linspace(0.0, 1.0, fade, dtype=np.float32)
        segment = segment.copy()
        segment[:fade] = original[start : start + fade] * (1.0 - ramp) + segment[:fade] * ramp
        segment[-fade:] = segment[-fade:] * (1.0 - ramp) + original[end - fade : end] * ramp
    original[start:end] = segment


def _transform_mono(
    mono: np.ndarray,
    sample_rate: int,
    *,
    mode: str,
    pitch_semitones: float,
    formant_shift: float,
) -> np.ndarray:
    import librosa

    if mode == "rvc":
        from .vocal_ml_models import convert_guide_with_rvc

        stereo = np.stack([mono, mono], axis=0)
        out = convert_guide_with_rvc(stereo, sample_rate, pitch_semitones=pitch_semitones)
        return ((out[0] + out[1]) * 0.5).astype(np.float32)

    if mode == "pitch":
        shifted = librosa.effects.pitch_shift(mono, sr=sample_rate, n_steps=float(pitch_semitones))
        return np.asarray(shifted, dtype=np.float32)

    if mode == "robot":
        t = np.arange(mono.shape[0], dtype=np.float32) / float(sample_rate)
        carrier = np.sin(2.0 * np.pi * 55.0 * t).astype(np.float32)
        return (mono * carrier * 1.6).astype(np.float32)

    # formant: pitch up then stretch back (shifts formants without net pitch)
    steps = float(formant_shift if formant_shift else pitch_semitones or 2.0)
    if abs(steps) < 0.01:
        return mono.copy()
    pitched = librosa.effects.pitch_shift(mono, sr=sample_rate, n_steps=steps)
    rate = 2.0 ** (steps / 12.0)
    stretched = librosa.effects.time_stretch(pitched, rate=rate)
    out = np.asarray(stretched, dtype=np.float32)
    if out.shape[0] < mono.shape[0]:
        out = np.pad(out, (0, mono.shape[0] - out.shape[0]))
    return out[: mono.shape[0]]


def transform_vocal_regions(
    vocals_mono: np.ndarray,
    sample_rate: int,
    regions: list[tuple[float, float]],
    *,
    mode: str = "pitch",
    pitch_semitones: float = 0.0,
    formant_shift: float = 0.0,
) -> np.ndarray:
    """Apply mode to listed regions; leave other samples unchanged."""
    mode = normalize_mode(mode)
    out = vocals_mono.copy()
    if not regions:
        # Full-track transform when no regions given.
        regions = [(0.0, vocals_mono.shape[0] / float(sample_rate))]

    fade = int(_CROSSFADE_SEC * sample_rate)
    for start_sec, end_sec in regions:
        start = int(start_sec * sample_rate)
        end = int(end_sec * sample_rate)
        start = max(0, min(start, vocals_mono.shape[0]))
        end = max(start, min(end, vocals_mono.shape[0]))
        if end <= start:
            continue
        # Transform a padded window so pitch/RVC edge artifacts stay outside the fade.
        pad = fade
        win_start = max(0, start - pad)
        win_end = min(vocals_mono.shape[0], end + pad)
        window = vocals_mono[win_start:win_end]
        transformed = _transform_mono(
            window,
            sample_rate,
            mode=mode,
            pitch_semitones=pitch_semitones,
            formant_shift=formant_shift,
        )
        if transformed.shape[0] != window.shape[0]:
            if transformed.shape[0] < window.shape[0]:
                transformed = np.pad(transformed, (0, window.shape[0] - transformed.shape[0]))
            transformed = transformed[: window.shape[0]]
        local = out[win_start:win_end].copy()
        _apply_crossfade(local, transformed, start - win_start, end - win_start, fade)
        out[win_start:win_end] = local
    return out.astype(np.float32)


def _mix_instrumental(paths: dict[str, str], sample_rate: int) -> np.ndarray:
    """Sum non-vocal stems to stereo. Falls back to zeros if only vocals present."""
    instrumental = None
    for name, path in paths.items():
        stem_name = os.path.basename(name).lower().replace(".wav", "")
        if stem_name == "vocals":
            continue
        stereo, sr = _load_wav_stereo(path)
        if sr != sample_rate:
            import librosa

            stereo = np.stack(
                [librosa.resample(stereo[0], orig_sr=sr, target_sr=sample_rate),
                 librosa.resample(stereo[1], orig_sr=sr, target_sr=sample_rate)],
                axis=0,
            )
        if instrumental is None:
            instrumental = stereo
        else:
            n = max(instrumental.shape[1], stereo.shape[1])
            if instrumental.shape[1] < n:
                instrumental = np.pad(instrumental, ((0, 0), (0, n - instrumental.shape[1])))
            if stereo.shape[1] < n:
                stereo = np.pad(stereo, ((0, 0), (0, n - stereo.shape[1])))
            instrumental = instrumental + stereo
    if instrumental is None:
        return np.zeros((2, 1), dtype=np.float32)
    return instrumental.astype(np.float32)


@register("vocal.transform")
def run_vocal_transform(ctx: JobContext) -> dict[str, Any]:
    raw: bytes = ctx.payload["raw"]
    filename = str(ctx.payload.get("filename") or "mix.wav")
    mode = normalize_mode(ctx.payload.get("mode"))
    output = normalize_output(ctx.payload.get("output"))
    regions = parse_regions(ctx.payload.get("regions"))
    pitch_semitones = float(ctx.payload.get("pitch_semitones") or 0.0)
    formant_shift = float(ctx.payload.get("formant_shift") or 0.0)

    if not stems_available():
        raise RuntimeError("stem separation deps missing — npm run sidecar:stems")
    if mode == "rvc":
        from .vocal_ml_models import rvc_ready

        if not rvc_ready():
            raise RuntimeError("RVC not configured — npm run sidecar:vocal-rvc or set AIMC_RVC_API_URL")

    ctx.set_progress(0.1, "separating stems")
    from .stems_separate import preferred_stems_backend

    model_name = "melband" if preferred_stems_backend() == "melband" else "htdemucs"
    separated = separate_audio(raw, filename=filename, model_name=model_name)
    paths: dict[str, str] = separated.get("paths") or {}
    vocals_path = None
    for name, path in paths.items():
        if "vocal" in os.path.basename(name).lower():
            vocals_path = path
            break
    if not vocals_path:
        raise RuntimeError("Demucs did not return a vocals stem")

    ctx.set_progress(0.45, f"transforming vocals ({mode})")
    vocals_mono, sr = _load_wav_mono(vocals_path)
    new_vocals = transform_vocal_regions(
        vocals_mono,
        sr,
        regions,
        mode=mode,
        pitch_semitones=pitch_semitones,
        formant_shift=formant_shift,
    )

    result: dict[str, Any] = {
        "mode": mode,
        "sample_rate": sr,
        "regions": [{"start_sec": s, "end_sec": e} for s, e in regions],
        "model": separated.get("model"),
        "device": separated.get("device"),
    }

    ctx.set_progress(0.8, "writing outputs")
    out_dir = tempfile.mkdtemp(prefix="vocal_xf_")
    if output in ("vocals", "both"):
        vocals_bytes = _write_wav_bytes(new_vocals, sr)
        vocals_out = os.path.join(out_dir, "vocals-transformed.wav")
        with open(vocals_out, "wb") as handle:
            handle.write(vocals_bytes)
        result["vocals_path"] = vocals_out

    if output in ("remix", "both"):
        instrumental = _mix_instrumental(paths, sr)
        n = max(instrumental.shape[1], new_vocals.shape[0])
        if instrumental.shape[1] < n:
            instrumental = np.pad(instrumental, ((0, 0), (0, n - instrumental.shape[1])))
        vocals_stereo = np.stack([new_vocals, new_vocals], axis=0)
        if vocals_stereo.shape[1] < n:
            vocals_stereo = np.pad(vocals_stereo, ((0, 0), (0, n - vocals_stereo.shape[1])))
        remix = instrumental[:, :n] + vocals_stereo[:, :n]
        remix_bytes = _write_wav_bytes(remix, sr)
        remix_out = os.path.join(out_dir, "remix-transformed.wav")
        with open(remix_out, "wb") as handle:
            handle.write(remix_bytes)
        result["remix_path"] = remix_out

    result["out_dir"] = out_dir
    ctx.set_progress(0.95, "done")
    return result


def transform_via_jobs(
    raw: bytes,
    *,
    filename: str = "mix.wav",
    mode: str = "pitch",
    regions: list[dict[str, float]] | None = None,
    pitch_semitones: float = 0.0,
    formant_shift: float = 0.0,
    output: str = "both",
) -> dict[str, Any]:
    job = JOBS.run_inline(
        "vocal.transform",
        {
            "raw": raw,
            "filename": filename,
            "mode": mode,
            "regions": regions or [],
            "pitch_semitones": pitch_semitones,
            "formant_shift": formant_shift,
            "output": output,
        },
        label="vocal-transform",
    )
    assert job.result is not None
    return {"job_id": job.job_id, **job.result}
