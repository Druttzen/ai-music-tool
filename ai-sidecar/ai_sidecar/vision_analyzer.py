"""Optional BLIP captioning + CLIP zero-shot tags for analyzer sidecar.

Models:
- Salesforce/blip-image-captioning-base (BSD-3-Clause weights, Apache-2.0 code)
- openai/clip-vit-base-patch32 (MIT)

Heavy — install via `npm run sidecar:vision`.
"""

from __future__ import annotations

import os
from typing import Any

MODEL_ID = "Salesforce/blip-image-captioning-base"
CAPTION_OFF_ENV = "AIMC_CAPTION_OFF"
CLIP_MODEL_ID = "openai/clip-vit-base-patch32"

_PIPE: Any = None
_CLIP_PIPE: Any = None

# Music / production oriented zero-shot labels (map to Suno Style tags client-side).
CLIP_CANDIDATE_LABELS = [
    "dark ambient drone",
    "bright energetic pop",
    "industrial techno warehouse",
    "cinematic orchestral score",
    "lo-fi bedroom guitar",
    "heavy metal aggression",
    "soft acoustic folk",
    "retro 80s synthwave",
    "trap hip-hop beat",
    "jazz lounge saxophone",
    "epic trailer percussion",
    "dreamy shoegaze wash",
    "minimal house groove",
    "gothic darkwave vocals",
    "tropical dancehall sunshine",
    "spacey progressive electronic",
    "punk rock garage energy",
    "chillwave vapor nostalgia",
    "classical piano ballad",
    "club EDM festival drop",
    "neon cyberpunk synth night",
    "warm intimate R&B soul",
]


def vision_analysis_available() -> bool:
    try:
        import PIL  # noqa: F401, PLC0415
        import torch  # noqa: F401, PLC0415
        import transformers  # noqa: F401, PLC0415

        return True
    except Exception:
        return False


def _pipeline_device(device_name: str) -> int:
    if device_name != "cuda":
        return -1
    try:
        import torch  # noqa: PLC0415

        return 0 if torch.cuda.is_available() else -1
    except Exception:
        return -1


def caption_pipeline_task() -> str:
    """Transformers 5 dropped `image-to-text`; prefer `image-text-to-text`."""
    try:
        from transformers.pipelines import check_task  # noqa: PLC0415
    except Exception:
        return "image-text-to-text"
    for task in ("image-text-to-text", "image-to-text"):
        try:
            check_task(task)
            return task
        except Exception:
            continue
    return "image-text-to-text"


def _get_pipeline(device_name: str):
    global _PIPE
    if _PIPE is not None:
        return _PIPE

    from transformers import pipeline  # noqa: PLC0415

    _PIPE = pipeline(
        caption_pipeline_task(),
        model=MODEL_ID,
        device=_pipeline_device(device_name),
    )
    return _PIPE


def _get_clip_pipeline(device_name: str):
    global _CLIP_PIPE
    if _CLIP_PIPE is not None:
        return _CLIP_PIPE

    from transformers import pipeline  # noqa: PLC0415

    _CLIP_PIPE = pipeline(
        "zero-shot-image-classification",
        model=CLIP_MODEL_ID,
        device=_pipeline_device(device_name),
    )
    return _CLIP_PIPE


def clip_tags_for_image_bytes(
    raw: bytes,
    *,
    device: str = "cpu",
    top_k: int = 5,
) -> list[dict[str, float]] | None:
    """Return top CLIP zero-shot tags or None when vision deps fail."""
    if not vision_analysis_available() or not raw:
        return None

    try:
        from PIL import Image  # noqa: PLC0415
        import io

        image = Image.open(io.BytesIO(raw)).convert("RGB")
        max_edge = 512
        if max(image.size) > max_edge:
            image.thumbnail((max_edge, max_edge))

        pipe = _get_clip_pipeline(device)
        raw_tags = pipe(image, candidate_labels=CLIP_CANDIDATE_LABELS)
        tags = [
            {"label": str(item["label"]), "score": float(item["score"])}
            for item in sorted(raw_tags, key=lambda x: x["score"], reverse=True)[:top_k]
        ]
        return tags or None
    except Exception:
        return None


def caption_image_bytes(raw: bytes, *, device: str = "cpu") -> str | None:
    """Return a short BLIP caption or None when vision deps/model fail."""
    if os.environ.get(CAPTION_OFF_ENV) == "1":
        return None
    if not vision_analysis_available() or not raw:
        return None

    try:
        from PIL import Image  # noqa: PLC0415
        import io

        image = Image.open(io.BytesIO(raw)).convert("RGB")
        max_edge = 512
        if max(image.size) > max_edge:
            image.thumbnail((max_edge, max_edge))

        pipe = _get_pipeline(device)
        try:
            result = pipe(image, text="A photo of")
        except TypeError:
            result = pipe(image)
        if not result:
            return None
        first = result[0] if isinstance(result, list) else result
        if isinstance(first, dict):
            caption = str(first.get("generated_text") or first.get("caption") or "").strip()
        else:
            caption = str(first).strip()
        return caption or None
    except Exception:
        return None
