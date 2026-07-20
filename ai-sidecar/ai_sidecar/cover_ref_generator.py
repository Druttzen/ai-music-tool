"""Optional FLUX img2img album cover from a reference image.

Uses the same FLUX.1-schnell family as text cover when available.
Heavy — install via `npm run sidecar:cover-ref` (independent of sidecar:cover).
"""

from __future__ import annotations

import io
import os
from typing import Any

MODEL_ID = "black-forest-labs/FLUX.1-schnell"
_PIPE: Any = None


def cover_ref_available() -> bool:
    try:
        import torch  # noqa: F401, PLC0415
        import diffusers  # noqa: F401, PLC0415
        from PIL import Image  # noqa: F401, PLC0415

        return True
    except Exception:
        return False


def active_cover_ref_model_id() -> str:
    return os.environ.get("AIMC_COVER_REF_MODEL", "").strip() or MODEL_ID


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


def _get_img2img_pipeline(device_name: str):
    global _PIPE
    if _PIPE is not None:
        return _PIPE

    import torch  # noqa: PLC0415

    torch_device = _select_torch_device(device_name)
    dtype = torch.bfloat16 if torch_device == "cuda" else torch.float32
    model_id = active_cover_ref_model_id()

    try:
        from diffusers import FluxImg2ImgPipeline  # noqa: PLC0415

        pipe = FluxImg2ImgPipeline.from_pretrained(model_id, torch_dtype=dtype)
    except Exception:
        # Older diffusers: fall back to text pipeline + encode path is not available;
        # re-raise with clear install guidance.
        raise RuntimeError(
            "FLUX img2img pipeline unavailable — upgrade diffusers or npm run sidecar:cover-ref"
        ) from None

    if torch_device == "cpu":
        pipe.enable_model_cpu_offload()
    else:
        pipe = pipe.to(torch_device)
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

    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    image = image.resize((w, h), Image.Resampling.LANCZOS)

    pipe = _get_img2img_pipeline(device)
    generator = None
    if seed is not None:
        torch_device = _select_torch_device(device)
        generator = torch.Generator(device="cpu" if torch_device == "mps" else torch_device).manual_seed(
            int(seed)
        )

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
