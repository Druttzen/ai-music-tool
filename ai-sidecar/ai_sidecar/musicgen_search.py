"""Sequential best-of-N MusicGen search with explicit seeds and saved alternatives."""
from __future__ import annotations

import secrets
import tempfile
from pathlib import Path

from .artifact_contracts import normalize_audio_result
from .device import select_device
from .jobs import JOBS, register
from .musicgen import generate_music_wav, generation_available


def draft_seeds(seed: int | None, count: int) -> list[int]:
    if count not in (2, 3, 4):
        raise ValueError("candidate_count must be 2, 3, or 4")
    if seed is not None and not 0 <= seed <= 0x7fffffff:
        raise ValueError("seed must be between 0 and 2147483647")
    first = secrets.randbelow(0x80000000) if seed is None else seed
    return [(first + i) % 0x80000000 for i in range(count)]


@register("generate.musicgen.search")
def run_draft_search(ctx):
    from .draft_ranker import decode_rank_audio, rank_drafts
    payload = ctx.payload
    seeds = draft_seeds(payload.get("seed"), int(payload.get("candidate_count", 3)))
    reference = payload.get("reference_wav")
    if reference:
        decode_rank_audio(reference)
    device = select_device()
    takes, metas, paths = [], [], []
    try:
        for index, seed in enumerate(seeds):
            ctx.raise_if_cancelled()
            ctx.set_progress(index / len(seeds) * 0.8, f"take {index + 1}/{len(seeds)}: seed {seed}")

            def progress(done, total):
                ctx.raise_if_cancelled()
                ctx.set_progress((index + done / max(total, 1)) / len(seeds) * 0.8,
                                 f"take {index + 1}/{len(seeds)}: seed {seed}")

            raw, meta = generate_music_wav(
                payload["prompt"], duration_sec=payload["duration_sec"], device=device,
                melody_wav=reference if payload.get("condition_melody") else None,
                seed=seed, on_progress=progress, check_cancelled=ctx.raise_if_cancelled,
                **{key: payload[key] for key in ("model", "temperature", "top_k", "top_p", "cfg_coef") if payload.get(key) is not None},
            )
            ctx.raise_if_cancelled()
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as output:
                paths.append(output.name)
                output.write(raw)
            takes.append(raw)
            metas.append(meta)
        ctx.set_progress(0.85, "comparing local takes")
        ranking = rank_drafts(payload["prompt"], takes, reference)
        ctx.raise_if_cancelled()
        selected = max(range(len(seeds)), key=lambda i: ranking["scores"][i]["score"]) if ranking["ranked"] else 0
        candidates = [{"index": i, "seed": seed, "path": paths[i], **ranking["scores"][i]} for i, seed in enumerate(seeds)]
        meta = {**metas[selected], "draft_search": {"selected_index": selected, "reference_used": bool(reference),
                "ranker": ranking["ranker"], "ranked": ranking["ranked"], "note": ranking["note"], "candidates": candidates}}
        return normalize_audio_result({"path": paths[selected], "model": meta["model"], "device": device, "meta": meta})
    except BaseException:
        for path in paths:
            Path(path).unlink(missing_ok=True)
        raise


def enqueue_draft_search(prompt: str, *, candidate_count=3, seed=None, **options) -> str:
    text = str(prompt or "").strip()
    if not text:
        raise ValueError("prompt is required")
    draft_seeds(seed, candidate_count)
    if options.get("condition_melody") and not options.get("reference_wav"):
        raise ValueError("Melody-conditioned draft search needs reference audio")
    if not generation_available():
        raise RuntimeError("MusicGen dependencies are missing")
    return JOBS.start("generate.musicgen.search", {"prompt": text, "seed": seed, "candidate_count": candidate_count, **options}, label="musicgen-drafts").job_id
