"""Optional MusicGen text-to-music generation (audiocraft).

Model weights are CC-BY-NC — opt-in only via `npm run sidecar:generate`.
Configure with AIMC_MUSICGEN_MODEL (default: facebook/musicgen-small).
Melody conditioning requires a melody-capable checkpoint; when a non-melody
model is configured, /generate/melody auto-switches to
AIMC_MUSICGEN_MELODY_MODEL (default: facebook/musicgen-melody).
"""

from __future__ import annotations

import io
import os
import gc
from typing import Any, Callable

DEFAULT_MODEL_ID = "facebook/musicgen-small"
DEFAULT_MELODY_MODEL_ID = "facebook/musicgen-melody"
MEDIUM_MODEL_ID = "facebook/musicgen-medium"
_TARGET_SR = 32_000

_MODEL: Any = None
_ACTIVE_MODEL_ID: str | None = None
_ACTIVE_DEVICE: str | None = None


def active_musicgen_model_id() -> str:
    return os.environ.get("AIMC_MUSICGEN_MODEL", "").strip() or DEFAULT_MODEL_ID


def active_musicgen_melody_model_id() -> str:
    return (
        os.environ.get("AIMC_MUSICGEN_MELODY_MODEL", "").strip()
        or DEFAULT_MELODY_MODEL_ID
    )


def model_supports_melody(model_id: str) -> bool:
    return "melody" in str(model_id or "").lower()


def resolve_musicgen_model_id(*, wants_melody: bool, requested: str | None = None) -> str:
    preset = str(requested or "").strip().lower()
    if preset in {"small", DEFAULT_MODEL_ID}:
        configured = DEFAULT_MODEL_ID
    elif preset in {"medium", MEDIUM_MODEL_ID}:
        configured = MEDIUM_MODEL_ID
    elif preset in {"stereo-small", "stereo-medium", "stereo-melody"}:
        configured = f"facebook/musicgen-{preset}"
    elif preset in {"melody", DEFAULT_MELODY_MODEL_ID}:
        configured = DEFAULT_MELODY_MODEL_ID
    elif preset.startswith("facebook/"):
        configured = preset
    else:
        configured = active_musicgen_model_id()
    if wants_melody and not model_supports_melody(configured):
        if "stereo" in configured:
            return "facebook/musicgen-stereo-melody"
        return active_musicgen_melody_model_id()
    return configured


def warmup_musicgen() -> None:
    """Load the default text model so the first preview is not a cold start."""
    if not generation_available():
        return
    from .device import select_device
    from .idle import touch_activity

    touch_activity()
    _get_model(select_device(), active_musicgen_model_id())
    touch_activity()


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


def _get_model(device_name: str, model_id: str | None = None):
    global _MODEL, _ACTIVE_MODEL_ID, _ACTIVE_DEVICE
    resolved = model_id or active_musicgen_model_id()
    torch_device = _select_torch_device(device_name)
    if _MODEL is not None and _ACTIVE_MODEL_ID == resolved and _ACTIVE_DEVICE == torch_device:
        return _MODEL, resolved

    from audiocraft.models import MusicGen  # noqa: PLC0415

    # Release the old model before loading another checkpoint on a consumer GPU.
    _MODEL = None
    _ACTIVE_MODEL_ID = None
    _ACTIVE_DEVICE = None
    gc.collect()
    if torch_device == "cuda":
        import torch
        torch.cuda.empty_cache()
    model = MusicGen.get_pretrained(resolved, device=torch_device)
    _MODEL = model
    _ACTIVE_MODEL_ID = resolved
    _ACTIVE_DEVICE = torch_device
    return model, resolved


def generate_music_wav(
    prompt: str,
    *,
    duration_sec: float = 10.0,
    melody_wav: bytes | None = None,
    device: str = "cpu",
    temperature: float | None = None,
    top_k: int | None = None,
    top_p: float | None = None,
    cfg_coef: float | None = None,
    seed: int | None = None,
    model: str | None = None,
    on_progress: Callable[[int, int], None] | None = None,
    check_cancelled: Callable[[], None] | None = None,
) -> tuple[bytes, dict[str, Any]]:
    """Return WAV bytes and metadata for a text prompt."""
    if not generation_available():
        raise RuntimeError("MusicGen deps missing — npm run sidecar:generate")

    from .idle import touch_activity  # noqa: PLC0415 — keep long loads from idle-exiting

    text = str(prompt or "").strip()
    if not text:
        raise ValueError("prompt is required")

    duration = max(1.0, min(float(duration_sec or 10.0), 30.0))
    wants_melody = bool(melody_wav)
    model_id = resolve_musicgen_model_id(wants_melody=wants_melody, requested=model)
    touch_activity()
    model, model_id = _get_model(device, model_id)
    touch_activity()
    if check_cancelled is not None:
        check_cancelled()
    # Separate guidance passes reduce peak VRAM rather than silently downgrading
    # a requested checkpoint to small.
    generation_params: dict[str, Any] = {"duration": duration, "two_step_cfg": True}
    if temperature is not None:
        generation_params["temperature"] = max(0.1, min(float(temperature), 2.0))
    if top_k is not None:
        generation_params["top_k"] = max(0, min(int(top_k), 500))
    if top_p is not None:
        generation_params["top_p"] = max(0.0, min(float(top_p), 1.0))
    if cfg_coef is not None:
        generation_params["cfg_coef"] = max(0.0, min(float(cfg_coef), 10.0))
    model.set_generation_params(**generation_params)

    import torch  # noqa: PLC0415

    previous_progress_callback = getattr(model, "_progress_callback", None)

    def report_generation_progress(generated: int, total: int) -> None:
        if check_cancelled is not None:
            check_cancelled()
        if on_progress is not None:
            on_progress(generated, total)

    use_progress_callback = on_progress is not None or check_cancelled is not None
    if use_progress_callback:
        model.set_custom_progress_callback(report_generation_progress)

    try:
        with torch.inference_mode():
            if seed is not None:
                torch.manual_seed(max(0, min(int(seed), 2**31 - 1)))
            touch_activity()
            if melody_wav:
                import io as _io  # noqa: PLC0415

                import librosa  # noqa: PLC0415

                y, melody_sr = librosa.load(_io.BytesIO(melody_wav), sr=None, mono=True)
                if check_cancelled is not None:
                    check_cancelled()
                melody_tensor = torch.from_numpy(y).float().unsqueeze(0)
                wav = model.generate_with_chroma(
                    [text],
                    melody_tensor,
                    melody_sr,
                    progress=use_progress_callback,
                )
                mode = "melody"
            else:
                wav = model.generate([text], progress=use_progress_callback)
                mode = "text"
            if check_cancelled is not None:
                check_cancelled()
            touch_activity()
    finally:
        if use_progress_callback:
            model.set_custom_progress_callback(previous_progress_callback)

    tensor = wav[0].detach().cpu().numpy()
    sample_rate = int(getattr(model, "sample_rate", _TARGET_SR))
    wav_bytes, audio_meta = encode_musicgen_wav(tensor, sample_rate)
    meta = {
        "model": model_id,
        **audio_meta,
        "device": _select_torch_device(device),
        "mode": mode,
        "temperature": generation_params.get("temperature"),
        "top_k": generation_params.get("top_k"),
        "top_p": generation_params.get("top_p"),
        "cfg_coef": generation_params.get("cfg_coef"),
        "seed": seed,
    }
    return wav_bytes, meta


def encode_musicgen_wav(channels_first: Any, sample_rate: int) -> tuple[bytes, dict[str, Any]]:
    """Preserve model channels and sample rate, with linked peak headroom.

    PCM24 preserves the decoder output for further editing; it does not create
    information beyond the model's bandwidth or improve a poor composition.
    """
    import numpy as np
    import soundfile as sf

    audio = np.asarray(channels_first, dtype=np.float32)
    if audio.ndim == 1:
        audio = audio[None, :]
    if audio.ndim != 2 or audio.shape[0] not in (1, 2) or not audio.shape[1]:
        raise ValueError("MusicGen returned an invalid audio shape")
    if sample_rate <= 0 or not np.isfinite(audio).all():
        raise ValueError("MusicGen returned invalid audio samples")
    peak = float(np.max(np.abs(audio)))
    if peak < 1e-8:
        raise ValueError("MusicGen returned silent audio; try another seed or prompt")
    if peak > 0.95:
        audio = audio * (0.95 / peak)
    buf = io.BytesIO()
    sf.write(buf, audio.T, sample_rate, subtype="PCM_24", format="WAV")
    return buf.getvalue(), {
        "duration_sec": audio.shape[1] / sample_rate,
        "sample_rate": sample_rate,
        "channels": audio.shape[0],
        "bit_depth": 24,
    }
