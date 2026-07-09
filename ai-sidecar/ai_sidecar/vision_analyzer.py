"""Optional BLIP image captioning for Vocal Embed / analyzer sidecar.

Model: Salesforce/blip-image-captioning-base (BSD-3-Clause weights, Apache-2.0 code).
Heavy — install via `pip install -e ai-sidecar[vision]`.
"""

from __future__ import annotations

from typing import Any

MODEL_ID = "Salesforce/blip-image-captioning-base"

_PIPE: Any = None


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


def _get_pipeline(device_name: str):
    global _PIPE
    if _PIPE is not None:
        return _PIPE

    from transformers import pipeline  # noqa: PLC0415

    _PIPE = pipeline(
        "image-to-text",
        model=MODEL_ID,
        device=_pipeline_device(device_name),
    )
    return _PIPE


def caption_image_bytes(raw: bytes, *, device: str = "cpu") -> str | None:
    """Return a short BLIP caption or None when vision deps/model fail."""
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
        result = pipe(image)
        if not result:
            return None
        caption = str(result[0].get("generated_text", "")).strip()
        return caption or None
    except Exception:
        return None
