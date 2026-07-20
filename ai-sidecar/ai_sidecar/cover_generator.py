"""Optional FLUX.1-schnell album cover generation (text → image).

Weights: black-forest-labs/FLUX.1-schnell (Apache-2.0).
Heavy — install via `npm run sidecar:cover`.
"""

from __future__ import annotations

import io
import os
from typing import Any

MODEL_ID = "black-forest-labs/FLUX.1-schnell"
_PIPE: Any = None


def cover_available() -> bool:
    try:
        import torch  # noqa: F401, PLC0415
        import diffusers  # noqa: F401, PLC0415
        from PIL import Image  # noqa: F401, PLC0415

        return True
    except Exception:
        return False


def active_cover_model_id() -> str:
    return os.environ.get("AIMC_COVER_MODEL", "").strip() or MODEL_ID


def _select_torch_device(device_name: str) -> str:
    from .device import select_device

    preferred = device_name or select_device()
    try:
        import torch  # noqa: PLC0415

        if preferred == "cuda" and torch.cuda.is_available():
            return "cuda"
        mps = getattr(torch.backends, "mps", None)
        if preferred != "cpu" and mps is not None and mps.is_available():
            return "mps"
    except Exception:
        pass
    return "cpu"


def _get_pipeline(device_name: str):
    global _PIPE
    if _PIPE is not None:
        return _PIPE

    import torch  # noqa: PLC0415
    from diffusers import FluxPipeline  # noqa: PLC0415

    torch_device = _select_torch_device(device_name)
    dtype = torch.bfloat16 if torch_device == "cuda" else torch.float32
    pipe = FluxPipeline.from_pretrained(active_cover_model_id(), torch_dtype=dtype)
    if torch_device == "cpu":
        pipe.enable_model_cpu_offload()
    else:
        pipe = pipe.to(torch_device)
    _PIPE = pipe
    return _PIPE


def generate_cover_png(
    prompt: str,
    *,
    width: int = 1024,
    height: int = 1024,
    seed: int | None = None,
    num_inference_steps: int = 4,
    device: str = "cpu",
) -> tuple[bytes, dict[str, Any]]:
    """Return PNG bytes and metadata for a text prompt."""
    if not cover_available():
        raise RuntimeError("cover deps missing — npm run sidecar:cover")

    text = str(prompt or "").strip()
    if not text:
        raise ValueError("prompt is required")

    w = max(256, min(1536, int(width or 1024)))
    h = max(256, min(1536, int(height or 1024)))
    # FLUX prefers multiples of 8
    w = (w // 8) * 8
    h = (h // 8) * 8

    import torch  # noqa: PLC0415

    pipe = _get_pipeline(device)
    generator = None
    if seed is not None:
        torch_device = _select_torch_device(device)
        generator = torch.Generator(device="cpu" if torch_device == "mps" else torch_device).manual_seed(
            int(seed)
        )

    result = pipe(
        text,
        height=h,
        width=w,
        guidance_scale=0.0,
        num_inference_steps=max(1, min(20, int(num_inference_steps or 4))),
        max_sequence_length=256,
        generator=generator,
    )
    image = result.images[0]
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    meta = {
        "model": active_cover_model_id(),
        "width": w,
        "height": h,
        "seed": seed,
        "mode": "text",
    }
    return buf.getvalue(), meta
