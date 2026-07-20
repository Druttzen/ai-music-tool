"""Optional MusicGen text-to-music generation (audiocraft).

Model weights are CC-BY-NC — opt-in only via `pip install -e ai-sidecar[generate]`.
Configure with AIMC_MUSICGEN_MODEL (default: facebook/musicgen-small).
"""

from __future__ import annotations

import io
import os
from typing import Any

DEFAULT_MODEL_ID = "facebook/musicgen-small"
_TARGET_SR = 32_000

_MODEL: Any = None
_ACTIVE_MODEL_ID: str | None = None


def active_musicgen_model_id() -> str:
    return os.environ.get("AIMC_MUSICGEN_MODEL", "").strip() or DEFAULT_MODEL_ID


def generation_available() -> bool:
    try:
        import torch  # noqa: F401, PLC0415
        from audiocraft.models import MusicGen  # noqa: F401, PLC0415

        return True
    except Exception:
        return False


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


def _get_model(device_name: str):
    global _MODEL, _ACTIVE_MODEL_ID
    model_id = active_musicgen_model_id()
    if _MODEL is not None and _ACTIVE_MODEL_ID == model_id:
        return _MODEL, model_id

    from audiocraft.models import MusicGen  # noqa: PLC0415

    torch_device = _select_torch_device(device_name)
    model = MusicGen.get_pretrained(model_id, device=torch_device)
    _MODEL = model
    _ACTIVE_MODEL_ID = model_id
    return model, model_id


def generate_music_wav(
    prompt: str,
    *,
    duration_sec: float = 10.0,
    melody_wav: bytes | None = None,
    device: str = "cpu",
) -> tuple[bytes, dict[str, Any]]:
    """Return WAV bytes and metadata for a text prompt."""
    if not generation_available():
        raise RuntimeError("MusicGen deps missing — pip install -e ai-sidecar[generate]")

    text = str(prompt or "").strip()
    if not text:
        raise ValueError("prompt is required")

    duration = max(1.0, min(float(duration_sec or 10.0), 30.0))
    model, model_id = _get_model(device)
    model.set_generation_params(duration=duration)

    import torch  # noqa: PLC0415

    with torch.inference_mode():
        if melody_wav:
            import io as _io  # noqa: PLC0415

            import librosa  # noqa: PLC0415

            y, melody_sr = librosa.load(_io.BytesIO(melody_wav), sr=None, mono=True)
            melody_tensor = torch.from_numpy(y).float().unsqueeze(0)
            wav = model.generate_with_chroma(
                [text],
                melody_tensor,
                melody_sr,
                progress=False,
            )
            mode = "melody"
        else:
            wav = model.generate([text], progress=False)
            mode = "text"

    import numpy as np  # noqa: PLC0415
    import soundfile as sf  # noqa: PLC0415

    tensor = wav[0].detach().cpu().numpy()
    if tensor.ndim == 2:
        mono = tensor.mean(axis=0)
    else:
        mono = tensor
    mono = np.asarray(mono, dtype=np.float32)
    peak = float(np.max(np.abs(mono))) or 1.0
    if peak > 0.98:
        mono = (mono * (0.95 / peak)).astype(np.float32)

    buf = io.BytesIO()
    sf.write(buf, mono, _TARGET_SR, subtype="PCM_16", format="WAV")
    meta = {
        "model": model_id,
        "duration_sec": duration,
        "sample_rate": _TARGET_SR,
        "device": _select_torch_device(device),
        "mode": mode,
    }
    return buf.getvalue(), meta
