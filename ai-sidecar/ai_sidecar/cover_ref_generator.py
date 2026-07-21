"""Optional FLUX img2img album cover from a reference image.

Uses the same FLUX.1-schnell family as text cover when available.
Heavy — install via `npm run sidecar:cover-ref` (independent of sidecar:cover).
"""

from __future__ import annotations

import io
import os
from typing import Any

from .cover_runtime import (
    build_cover_policy,
    generator_device_for_policy,
    place_cover_pipeline,
    torch_dtype_for_policy,
)

MODEL_ID = "black-forest-labs/FLUX.1-schnell"
MAX_COVER_REF_UPLOAD_BYTES = 25 * 1024 * 1024
MAX_COVER_REF_PIXELS = 40_000_000
_PIPE: Any = None


def cover_ref_available() -> bool:
    try:
        import torch  # noqa: F401, PLC0415
        from diffusers import FluxImg2ImgPipeline  # noqa: F401, PLC0415
        from PIL import Image  # noqa: F401, PLC0415

        return True
    except Exception:
        return False


def active_cover_ref_model_id() -> str:
    return os.environ.get("AIMC_COVER_REF_MODEL", "").strip() or MODEL_ID


def _get_img2img_pipeline(device_name: str):
    global _PIPE
    if _PIPE is not None:
        return _PIPE

    import torch  # noqa: PLC0415

    policy = build_cover_policy(device_name)
    dtype = torch_dtype_for_policy(torch, policy)
    model_id = active_cover_ref_model_id()

    try:
        from diffusers import FluxImg2ImgPipeline  # noqa: PLC0415
    except ImportError:
        raise RuntimeError(
            "FLUX img2img pipeline unavailable — upgrade diffusers or npm run sidecar:cover-ref"
        ) from None

    pipe = FluxImg2ImgPipeline.from_pretrained(model_id, torch_dtype=dtype)

    pipe = place_cover_pipeline(pipe, policy)
    _PIPE = pipe
    return _PIPE


def generate_cover_from_image_png(
    image_bytes: bytes,
    prompt: str,
    *,
    strength: float = 0.55,
    width: int = 1024,
    height: int = 1024,
    seed: int | None = None,
    num_inference_steps: int = 4,
    device: str = "cpu",
) -> tuple[bytes, dict[str, Any]]:
    """Return PNG bytes guided by a reference image + prompt."""
    if not cover_ref_available():
        raise RuntimeError("cover-ref deps missing — npm run sidecar:cover-ref")

    text = str(prompt or "").strip()
    if not text:
        raise ValueError("prompt is required")
    if not image_bytes:
        raise ValueError("image is required")

    from PIL import Image  # noqa: PLC0415
    import torch  # noqa: PLC0415

    strength_f = max(0.15, min(0.95, float(strength)))
    w = max(256, min(1536, int(width or 1024)))
    h = max(256, min(1536, int(height or 1024)))
    w = (w // 8) * 8
    h = (h // 8) * 8

    try:
        image = Image.open(io.BytesIO(image_bytes))
        if image.width * image.height > MAX_COVER_REF_PIXELS:
            raise ValueError(
                f"reference image is too large (max {MAX_COVER_REF_PIXELS:,} pixels)"
            )
        image.load()
        image = image.convert("RGB")
    except ValueError:
        raise
    except (OSError, SyntaxError, Image.DecompressionBombError) as exc:
        raise ValueError("invalid or unsupported reference image") from exc
    image = image.resize((w, h), Image.Resampling.LANCZOS)

    pipe = _get_img2img_pipeline(device)
    generator = None
    if seed is not None:
        policy = build_cover_policy(device)
        generator = torch.Generator(device=generator_device_for_policy(policy)).manual_seed(int(seed))

    result = pipe(
        prompt=text,
        image=image,
        strength=strength_f,
        guidance_scale=0.0,
        num_inference_steps=max(1, min(20, int(num_inference_steps or 4))),
        generator=generator,
    )
    out = result.images[0]
    buf = io.BytesIO()
    out.save(buf, format="PNG")
    meta = {
        "model": active_cover_ref_model_id(),
        "width": w,
        "height": h,
        "seed": seed,
        "strength": strength_f,
        "mode": "img2img",
    }
    return buf.getvalue(), meta
