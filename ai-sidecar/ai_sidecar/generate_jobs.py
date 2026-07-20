"""MusicGen generation via JobManager."""

from __future__ import annotations

import tempfile
from typing import Any

from .device import select_device
from .jobs import JOBS, JobContext, register
from .musicgen import active_musicgen_model_id, generate_music_wav, generation_available


@register("generate.musicgen")
def run_musicgen(ctx: JobContext) -> dict[str, Any]:
    prompt = str(ctx.payload.get("prompt") or "").strip()
    duration_sec = float(ctx.payload.get("duration_sec") or 10.0)
    melody_wav = ctx.payload.get("melody_wav")
    device = select_device()
    ctx.set_progress(0.2, "loading MusicGen")
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
        "meta": meta,
        "device": device,
        "model": str(meta.get("model") or active_musicgen_model_id()),
    }


def generate_via_jobs(
    prompt: str,
    *,
    duration_sec: float = 10.0,
    melody_wav: bytes | None = None,
) -> dict[str, Any]:
    if not generation_available():
        raise RuntimeError("MusicGen deps missing — pip install -e ai-sidecar[generate]")
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
