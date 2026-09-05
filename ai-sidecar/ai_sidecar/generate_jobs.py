"""MusicGen + ACE-Step generation via JobManager."""

from __future__ import annotations

import tempfile
from typing import Any

from .device import build_policy, select_device
from .jobs import JOBS, JobContext, register
from .musicgen import active_musicgen_model_id, generate_music_wav, generation_available


@register("generate.musicgen")
def run_musicgen(ctx: JobContext) -> dict[str, Any]:
    prompt = str(ctx.payload.get("prompt") or "").strip()
    duration_sec = float(ctx.payload.get("duration_sec") or 10.0)
    melody_wav = ctx.payload.get("melody_wav")
    policy = build_policy()
    device = policy.device or select_device()
    ctx.set_progress(0.2, f"loading MusicGen ({device}, {policy.dtype})")
    wav_bytes, meta = generate_music_wav(
        prompt,
        duration_sec=duration_sec,
        melody_wav=melody_wav,
        device=device,
    )
    ctx.set_progress(0.9, "writing wav")
    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    tmp.write(wav_bytes)
    tmp.close()
    return {
        "path": tmp.name,
        "meta": {**(meta or {}), "policy": policy.as_dict()},
        "device": device,
        "model": str((meta or {}).get("model") or active_musicgen_model_id()),
    }


@register("generate.acestep")
def run_acestep(ctx: JobContext) -> dict[str, Any]:
    from .acestep_bridge import generate_acestep_song, normalize_song_format

    prompt = str(ctx.payload.get("prompt") or "").strip()
    ctx.set_progress(0.1, "submitting ACE-Step task")
    audio_format = normalize_song_format(ctx.payload.get("audio_format"))
    wav_bytes, meta = generate_acestep_song(
        prompt,
        lyrics=str(ctx.payload.get("lyrics") or ""),
        duration_sec=ctx.payload.get("duration_sec"),
        vocal_language=str(ctx.payload.get("vocal_language") or ""),
        bpm=ctx.payload.get("bpm"),
        key_scale=str(ctx.payload.get("key_scale") or ""),
        thinking=bool(ctx.payload.get("thinking", True)),
        audio_format=audio_format,
    )
    ctx.set_progress(0.9, "writing audio")
    suffix = f".{audio_format}"
    tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    tmp.write(wav_bytes)
    tmp.close()
    return {
        "path": tmp.name,
        "meta": meta or {},
        "model": str((meta or {}).get("model") or "acestep"),
        "audio_format": audio_format,
    }


def generate_via_jobs(
    prompt: str,
    *,
    duration_sec: float = 10.0,
    melody_wav: bytes | None = None,
) -> dict[str, Any]:
    if not generation_available():
        raise RuntimeError("MusicGen deps missing — npm run sidecar:generate")
    text = str(prompt or "").strip()
    if not text:
        raise ValueError("prompt is required")
    job = JOBS.run_inline(
        "generate.musicgen",
        {"prompt": text, "duration_sec": duration_sec, "melody_wav": melody_wav},
        label="musicgen",
    )
    assert job.result is not None
    return {"job_id": job.job_id, **job.result}


def generate_song_via_jobs(
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
    from .acestep_bridge import acestep_configured

    if not acestep_configured():
        raise RuntimeError(
            "ACE-Step not configured — set AIMC_ACESTEP_API_URL (see docs/acestep.md)"
        )
    text = str(prompt or "").strip()
    if not text:
        raise ValueError("prompt is required")
    job = JOBS.run_inline(
        "generate.acestep",
        {
            "prompt": text,
            "lyrics": lyrics,
            "duration_sec": duration_sec,
            "vocal_language": vocal_language,
            "bpm": bpm,
            "key_scale": key_scale,
            "thinking": thinking,
            "audio_format": audio_format,
        },
        label="acestep-song",
    )
    assert job.result is not None
    return {"job_id": job.job_id, **job.result}
