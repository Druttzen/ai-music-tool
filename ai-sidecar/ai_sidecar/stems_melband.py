"""Mel-Band RoFormer vocal/instrumental separation (opt-in extra).

Uses `melband-roformer-infer` 0.1.x (Kim vocals by default). Produces vocals +
instrumental (mixture − vocals). Enable via:

    npm run sidecar:stems-melband

Select with `model_name=melband` on POST /separate, or set
`AIMC_STEMS_BACKEND=melband` for vocal-transform defaults.
"""

from __future__ import annotations

import os
import tempfile
from typing import Any

from .device import build_policy, select_device
from .jobs import JobContext

_DEFAULT_MODEL = "melband-roformer-kim-vocals"
_MODEL_CACHE: dict[str, Any] = {}


def melband_available() -> bool:
    try:
        from mel_band_roformer import demix_track, ensure_model_assets, get_model_from_config  # noqa: F401
    except Exception:
        return False
    return True


def is_melband_model_name(model_name: str | None) -> bool:
    name = str(model_name or "").strip().lower()
    return name in {"melband", "melband-roformer", "mel-band", "melband-roformer-kim-vocals"} or name.startswith(
        "melband-"
    )


def resolve_melband_model_id(model_name: str | None) -> str:
    name = str(model_name or "").strip()
    if not name or name.lower() in {"melband", "melband-roformer", "mel-band"}:
        return os.environ.get("AIMC_MELBAND_MODEL", "").strip() or _DEFAULT_MODEL
    return name


def _select_torch_device(preferred: str) -> str:
    try:
        import torch

        if preferred == "cuda" and torch.cuda.is_available():
            return "cuda"
        mps = getattr(torch.backends, "mps", None)
        if preferred == "mps" and mps is not None and mps.is_available():
            return "mps"
    except Exception:
        pass
    return "cpu"


def _ensure_model_assets(model_id: str):
    """Resolve checkpoint/config; swallow library progress prints (emoji breaks cp1252)."""
    import contextlib
    import io
    import sys

    from mel_band_roformer import ensure_model_assets

    sink = io.StringIO()
    try:
        if hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        if hasattr(sys.stderr, "reconfigure"):
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    with contextlib.redirect_stdout(sink), contextlib.redirect_stderr(sink):
        return ensure_model_assets(model_id)


def _load_melband(model_id: str, device: str):
    key = f"{model_id}@{device}"
    if key in _MODEL_CACHE:
        return _MODEL_CACHE[key]

    import yaml
    from ml_collections import ConfigDict
    from mel_band_roformer import get_model_from_config
    from mel_band_roformer.inference import SafeLoaderWithTuple
    import torch

    ckpt_path, config_path = _ensure_model_assets(model_id)
    with open(config_path, encoding="utf-8") as handle:
        config = ConfigDict(yaml.load(handle, Loader=SafeLoaderWithTuple))
    model = get_model_from_config("mel_band_roformer", config)
    state = torch.load(ckpt_path, map_location="cpu")
    model.load_state_dict(state)
    model.to(device)
    model.eval()
    bundle = {"model": model, "config": config, "device": device, "model_id": model_id}
    _MODEL_CACHE[key] = bundle
    return bundle


def run_melband_separate(ctx: JobContext) -> dict[str, Any]:
    """Separate vocals/instrumental with Mel-Band RoFormer."""
    if not melband_available():
        raise RuntimeError("Mel-Band RoFormer deps missing — npm run sidecar:stems-melband")

    import numpy as np
    import soundfile as sf
    import torch
    from mel_band_roformer import demix_track

    raw: bytes = ctx.payload["raw"]
    filename = str(ctx.payload.get("filename") or "in.wav")
    model_id = resolve_melband_model_id(ctx.payload.get("model_name"))
    policy = build_policy()
    preferred = policy.device or select_device()
    device = _select_torch_device(preferred)

    suffix = os.path.splitext(filename)[1] or ".wav"
    tmp_in = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    tmp_in.write(raw)
    tmp_in.close()
    out_dir = tempfile.mkdtemp(prefix="melband_out_")

    try:
        ctx.set_progress(0.15, f"loading Mel-Band RoFormer ({device})")
        bundle = _load_melband(model_id, device)
        model = bundle["model"]
        config = bundle["config"]

        ctx.set_progress(0.35, "reading audio")
        mix, sr = sf.read(tmp_in.name)
        original_mono = False
        if getattr(mix, "ndim", 1) == 1:
            original_mono = True
            mix = np.stack([mix, mix], axis=-1)
        mixture = torch.tensor(mix.T, dtype=torch.float32)

        ctx.set_progress(0.5, "separating (melband)")
        res, _chunk_time = demix_track(config, model, mixture, device)

        instruments = list(config.training.instruments)
        target = getattr(config.training, "target_instrument", None)
        if target is not None:
            instruments = [target]
        if not instruments:
            raise RuntimeError("Mel-Band config has no instruments")

        primary = instruments[0]
        vocals_output = res[primary].T
        if original_mono:
            vocals_output = vocals_output[:, 0]

        original_mix, _ = sf.read(tmp_in.name)
        instrumental = original_mix - vocals_output

        vocals_path = os.path.join(out_dir, "vocals.wav")
        instrumental_path = os.path.join(out_dir, "instrumental.wav")
        sf.write(vocals_path, vocals_output, sr, subtype="PCM_16")
        sf.write(instrumental_path, instrumental, sr, subtype="PCM_16")

        stems = {"vocals": vocals_path, "instrumental": instrumental_path}
        ctx.set_progress(0.95, "writing stems")
        return {
            "device": device,
            "model": model_id,
            "backend": "melband",
            "sources": list(stems.keys()),
            "paths": {f"{name}.wav": path for name, path in stems.items()},
            "out_dir": out_dir,
            "policy": policy.as_dict(),
        }
    finally:
        try:
            os.unlink(tmp_in.name)
        except OSError:
            pass
