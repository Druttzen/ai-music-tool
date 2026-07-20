"""Demucs stem separation via JobManager."""

from __future__ import annotations

import os
import tempfile
from typing import Any

from .device import build_policy, select_device
from .jobs import JOBS, JobContext, register

_MODEL_CACHE: dict[str, Any] = {}


def stems_available() -> bool:
    try:
        import demucs  # noqa: F401
    except Exception:
        return False
    return True


def _load_demucs(model_name: str):
    import torch
    from demucs.pretrained import get_model

    if model_name not in _MODEL_CACHE:
        model = get_model(model_name)
        policy = build_policy()
        model.to(policy.device or select_device())
        model.eval()
        _MODEL_CACHE[model_name] = model
    return _MODEL_CACHE[model_name], torch


def _save_stem_wav(source, path: str, samplerate: int) -> None:
    import numpy as np
    import soundfile as sf

    if hasattr(source, "detach"):
        data = source.detach().cpu().numpy()
    else:
        data = np.asarray(source)
    if data.ndim == 2:
        data = data.T
    sf.write(path, data, samplerate, subtype="PCM_16")


@register("stems.separate")
def run_stem_separate(ctx: JobContext) -> dict[str, Any]:
    from demucs.apply import apply_model
    from demucs.audio import AudioFile

    raw: bytes = ctx.payload["raw"]
    filename = str(ctx.payload.get("filename") or "in.wav")
    model_name = str(ctx.payload.get("model_name") or "htdemucs")
    policy = build_policy()
    device = policy.device or select_device()

    suffix = os.path.splitext(filename)[1] or ".wav"
    tmp_in = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    tmp_in.write(raw)
    tmp_in.close()
    out_dir = tempfile.mkdtemp(prefix="stems_")

    try:
        ctx.set_progress(0.1, f"loading model ({device})")
        model, torch = _load_demucs(model_name)
        ctx.set_progress(0.3, "reading audio")
        wav = AudioFile(tmp_in.name).read(
            streams=0, samplerate=model.samplerate, channels=model.audio_channels
        )
        ref = wav.mean(0)
        wav = (wav - ref.mean()) / (ref.std() + 1e-8)
        ctx.set_progress(0.5, "separating")
        with torch.no_grad():
            estimates = apply_model(model, wav[None], device=device, progress=False)[0]
        estimates = estimates * (ref.std() + 1e-8) + ref.mean()
        stems: dict[str, str] = {}
        for source, name in zip(estimates, model.sources):
            path = os.path.join(out_dir, f"{name}.wav")
            _save_stem_wav(source, path, model.samplerate)
            stems[name] = path
        ctx.set_progress(0.95, "writing stems")
        return {
            "device": device,
            "model": model_name,
            "sources": list(model.sources),
            "paths": {f"{name}.wav": p for name, p in stems.items()},
            "out_dir": out_dir,
            "policy": policy.as_dict(),
        }
    finally:
        try:
            os.unlink(tmp_in.name)
        except OSError:
            pass


def separate_audio(raw: bytes, *, filename: str = "in.wav", model_name: str = "htdemucs") -> dict[str, Any]:
    if not raw:
        raise ValueError("empty upload")
    job = JOBS.run_inline(
        "stems.separate",
        {"raw": raw, "filename": filename, "model_name": model_name},
        label="separate",
    )
    assert job.result is not None
    return {"job_id": job.job_id, **job.result}
