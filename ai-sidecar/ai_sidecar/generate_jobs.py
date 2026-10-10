"""MusicGen + ACE-Step generation via JobManager."""

from __future__ import annotations

import tempfile
from typing import Any

from .artifact_contracts import normalize_audio_result
from .device import build_policy, select_device
from .jobs import JOBS, JobContext, register
from .musicgen import active_musicgen_model_id, generate_music_wav, generation_available


@register("generate.musicgen")
def run_musicgen(ctx: JobContext) -> dict[str, Any]:
    ctx.raise_if_cancelled()
    prompt = str(ctx.payload.get("prompt") or "").strip()
    duration_sec = float(ctx.payload.get("duration_sec") or 8.0)
    melody_wav = ctx.payload.get("melody_wav")
    generation_options = {
        key: ctx.payload.get(key)
        for key in ("temperature", "top_k", "top_p", "cfg_coef", "seed", "model")
        if ctx.payload.get(key) is not None
    }
    policy = build_policy()
    device = policy.device or select_device()
    ctx.set_progress(0.2, f"loading MusicGen ({device}, {policy.dtype})")

    def on_progress(generated: int, total: int) -> None:
        ctx.raise_if_cancelled()
        fraction = generated / max(total, 1)
        ctx.set_progress(0.2 + 0.7 * fraction, "generating MusicGen")

    wav_bytes, meta = generate_music_wav(
        prompt,
        duration_sec=duration_sec,
        melody_wav=melody_wav,
        device=device,
        on_progress=on_progress,
        check_cancelled=ctx.raise_if_cancelled,
        **generation_options,
    )
    ctx.raise_if_cancelled()
    ctx.set_progress(0.9, "writing wav")
    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    tmp.write(wav_bytes)
    tmp.close()
    return normalize_audio_result({
        "path": tmp.name,
        "meta": {**meta, "policy": policy.as_dict()},
        "device": device,
        "model": str(meta.get("model") or active_musicgen_model_id()),
    })


@register("generate.acestep")
def run_acestep(ctx: JobContext) -> dict[str, Any]:
    from .acestep_bridge import generate_acestep_song, normalize_song_format

    ctx.raise_if_cancelled()
    prompt = str(ctx.payload.get("prompt") or "").strip()
    ctx.set_progress(0.1, "submitting ACE-Step task")
    if ctx.payload.get("autostart"):
        from .acestep_lifecycle import ensure_acestep_api, resolve_acestep_dit_model

        ctx.set_progress(0.05, "checking ACE-Step API")
        requested_model = str(ctx.payload.get("model") or "")
        dit_id, dit_warning = resolve_acestep_dit_model(requested_model)
        if dit_warning:
            ctx.set_progress(0.06, dit_warning[:120])
        ensure_acestep_api(model=dit_id)
        # Prefer the resolved checkpoint id for release_task / on-demand load.
        ctx.payload["model"] = dit_id
    else:
        from .acestep_bridge import acestep_configured, acestep_reachable

        if not acestep_configured() or not acestep_reachable(timeout_sec=0.8):
            raise RuntimeError(
                "ACE-Step API unreachable — run npm run sidecar:acestep (see docs/acestep.md)"
            )
    plan = None
    if ctx.payload.get("compose"):
        from .composition import plan_composition

        plan = plan_composition(prompt, lyrics=str(ctx.payload.get("lyrics") or ""),
            duration_sec=ctx.payload.get("duration_sec"), instrumental=ctx.payload.get("instrumental", True),
            bpm=ctx.payload.get("bpm"), key_scale=str(ctx.payload.get("key_scale") or ""),
            vocal_language=str(ctx.payload.get("vocal_language") or ""),
            on_progress=ctx.set_progress, check_cancelled=ctx.raise_if_cancelled)
        prompt = plan["generation_prompt"]
    ctx.raise_if_cancelled()
    audio_format = normalize_song_format(ctx.payload.get("audio_format"))
    wav_bytes, meta = generate_acestep_song(
        prompt,
        lyrics=plan["lyrics"] if plan else str(ctx.payload.get("lyrics") or ""),
        duration_sec=plan["duration_sec"] if plan else ctx.payload.get("duration_sec"),
        vocal_language=plan["vocal_language"] if plan else str(ctx.payload.get("vocal_language") or ""),
        bpm=plan["bpm"] if plan else ctx.payload.get("bpm"),
        key_scale=plan["key_scale"] if plan else str(ctx.payload.get("key_scale") or ""),
        thinking=True if plan else bool(ctx.payload.get("thinking", True)),
        audio_format=audio_format,
        inference_steps=ctx.payload.get("inference_steps"),
        guidance_scale=ctx.payload.get("guidance_scale"),
        seed=ctx.payload.get("seed"),
        model=str(ctx.payload.get("model") or ""),
        **({"lm_model": plan.get("semantic_model") or plan["planner_model"], "time_signature": plan["time_signature"]} if plan else {}),
        on_progress=ctx.set_progress,
    )
    if plan:
        plan["reported_lm_model"] = str(meta.get("lm_model") or "")
        meta["composition_plan"] = plan
    ctx.raise_if_cancelled()
    ctx.set_progress(0.9, "writing audio")
    suffix = f".{audio_format}"
    tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    tmp.write(wav_bytes)
    tmp.close()
    return normalize_audio_result({
        "path": tmp.name,
        "meta": meta,
        "model": str(meta.get("model") or "acestep"),
        "audio_format": audio_format,
    })


def generate_via_jobs(
    prompt: str,
    *,
    duration_sec: float = 10.0,
    melody_wav: bytes | None = None,
    temperature: float | None = None,
    top_k: int | None = None,
    top_p: float | None = None,
    cfg_coef: float | None = None,
    seed: int | None = None,
    model: str | None = None,
) -> dict[str, Any]:
    if not generation_available():
        raise RuntimeError("MusicGen deps missing — npm run sidecar:generate")
    text = str(prompt or "").strip()
    if not text:
        raise ValueError("prompt is required")
    job = JOBS.run_inline(
        "generate.musicgen",
        _musicgen_payload(
            text,
            duration_sec=duration_sec,
            melody_wav=melody_wav,
            temperature=temperature,
            top_k=top_k,
            top_p=top_p,
            cfg_coef=cfg_coef,
            seed=seed,
            model=model,
        ),
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
    inference_steps: int | None = None,
    guidance_scale: float | None = None,
    seed: int | None = None,
    model: str = "",
    compose: bool = False,
    instrumental: bool = True,
) -> dict[str, Any]:
    text = str(prompt or "").strip()
    if not text:
        raise ValueError("prompt is required")
    job = JOBS.run_inline(
        "generate.acestep",
        _song_payload(
            text,
            lyrics=lyrics,
            duration_sec=duration_sec,
            vocal_language=vocal_language,
            bpm=bpm,
            key_scale=key_scale,
            thinking=thinking,
            audio_format=audio_format,
            inference_steps=inference_steps,
            guidance_scale=guidance_scale,
            seed=seed,
            model=model,
            compose=compose,
            instrumental=instrumental,
        ),
        label="acestep-song",
    )
    assert job.result is not None
    return {"job_id": job.job_id, **job.result}


def _musicgen_payload(
    prompt: str,
    *,
    duration_sec: float,
    melody_wav: bytes | None,
    temperature: float | None,
    top_k: int | None,
    top_p: float | None,
    cfg_coef: float | None,
    seed: int | None,
    model: str | None,
) -> dict[str, Any]:
    return {
        "prompt": prompt,
        "duration_sec": duration_sec,
        "melody_wav": melody_wav,
        "temperature": temperature,
        "top_k": top_k,
        "top_p": top_p,
        "cfg_coef": cfg_coef,
        "seed": seed,
        "model": model,
    }


def _song_payload(
    prompt: str,
    *,
    lyrics: str,
    duration_sec: float | None,
    vocal_language: str,
    bpm: int | None,
    key_scale: str,
    thinking: bool,
    audio_format: str,
    inference_steps: int | None,
    guidance_scale: float | None,
    seed: int | None,
    model: str,
    compose: bool = False,
    instrumental: bool = True,
) -> dict[str, Any]:
    return {
        "prompt": prompt,
        "lyrics": lyrics,
        "duration_sec": duration_sec,
        "vocal_language": vocal_language,
        "bpm": bpm,
        "key_scale": key_scale,
        "thinking": thinking,
        "audio_format": audio_format,
        "inference_steps": inference_steps,
        "guidance_scale": guidance_scale,
        "seed": seed,
        "model": model,
        "autostart": False,
        "compose": compose,
        "instrumental": instrumental,
    }


def enqueue_musicgen(
    prompt: str,
    *,
    duration_sec: float = 8.0,
    melody_wav: bytes | None = None,
    temperature: float | None = None,
    top_k: int | None = None,
    top_p: float | None = None,
    cfg_coef: float | None = None,
    seed: int | None = None,
    model: str | None = None,
) -> str:
    if not generation_available():
        raise RuntimeError("MusicGen deps missing — npm run sidecar:generate")
    text = str(prompt or "").strip()
    if not text:
        raise ValueError("prompt is required")
    job = JOBS.start(
        "generate.musicgen",
        _musicgen_payload(
            text,
            duration_sec=duration_sec,
            melody_wav=melody_wav,
            temperature=temperature,
            top_k=top_k,
            top_p=top_p,
            cfg_coef=cfg_coef,
            seed=seed,
            model=model,
        ),
        label="musicgen",
    )
    return job.job_id


def enqueue_song(
    prompt: str,
    *,
    lyrics: str = "",
    duration_sec: float | None = None,
    vocal_language: str = "",
    bpm: int | None = None,
    key_scale: str = "",
    thinking: bool = True,
    audio_format: str = "wav",
    inference_steps: int | None = None,
    guidance_scale: float | None = None,
    seed: int | None = None,
    model: str = "",
    compose: bool = False,
    instrumental: bool = True,
) -> str:
    text = str(prompt or "").strip()
    if not text:
        raise ValueError("prompt is required")
    payload = _song_payload(
        text,
        lyrics=lyrics,
        duration_sec=duration_sec,
        vocal_language=vocal_language,
        bpm=bpm,
        key_scale=key_scale,
        thinking=thinking,
        audio_format=audio_format,
        inference_steps=inference_steps,
        guidance_scale=guidance_scale,
        seed=seed,
        model=model,
        compose=compose,
        instrumental=instrumental,
    )
    payload["autostart"] = True
    job = JOBS.start("generate.acestep", payload, label="acestep-song")
    return job.job_id
