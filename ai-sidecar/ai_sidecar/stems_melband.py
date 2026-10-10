"""Local Mel-Band RoFormer vocal/instrumental separation.

Uses `melband-roformer-infer` 0.1.x. Clean mode uses verified Kim FT2 Bleedless;
standard mode uses Kim vocals. Produces vocals + instrumental (mixture − vocals).
Provision the dependencies and clean checkpoint before offline use:

    npm run sidecar:stems-melband

Select with `model_name=melband-clean` on POST /separate, or set
`AIMC_STEMS_BACKEND=melband` for vocal-transform defaults.
"""

from __future__ import annotations

import os
import math
import shutil
import tempfile
from typing import Any

from .device import build_policy, select_device
from .jobs import JobContext

_DEFAULT_MODEL = "melband-roformer-kim-vocals"
_CLEAN_MODEL = "melband-roformer-kimmel-ft2-bleedless"
_CLEAN_HASHES = {
    "kimmel_unwa_ft2_bleedless.ckpt": "3c450bd66a98b49dd03231fc5ebb84121eef8418236b179423c2b171d62b04d9",
    "config_kimmel_unwa_ft.yaml": "0942cb7da8e86ac1be840cc7b9647831c11ffe00327a0b239df256031e6c8355",
}
_MODEL_CACHE: dict[str, Any] = {}


def _sha256(path) -> str:
    import hashlib

    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _download_clean_assets(base):
    """Explicit setup only: download creator files atomically and verify both hashes."""
    import urllib.request
    from pathlib import Path

    target = Path(base) / _CLEAN_MODEL
    target.mkdir(parents=True, exist_ok=True)
    for filename, expected in _CLEAN_HASHES.items():
        destination = target / filename
        if destination.is_file():
            if _sha256(destination) == expected:
                continue
        partial = None
        try:
            with tempfile.NamedTemporaryFile(dir=target, suffix=".download", delete=False) as handle:
                partial = Path(handle.name)
                url = f"https://huggingface.co/pcunwa/Kim-Mel-Band-Roformer-FT/resolve/main/{filename}"
                with urllib.request.urlopen(url, timeout=120) as response:
                    shutil.copyfileobj(response, handle)
            if _sha256(partial) != expected:
                raise RuntimeError(f"Downloaded separation model failed integrity check: {filename}")
            partial.replace(destination)
        finally:
            if partial is not None:
                partial.unlink(missing_ok=True)
    return tuple(target / name for name in _CLEAN_HASHES)


def melband_available() -> bool:
    from .model_readiness import addon_enabled
    if not addon_enabled("stems-melband"):
        return False
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
    if name.lower() == "melband-clean":
        return _CLEAN_MODEL
    if not name or name.lower() in {"melband", "melband-roformer", "mel-band"}:
        return os.environ.get("AIMC_MELBAND_MODEL", "").strip() or _DEFAULT_MODEL
    return name


def _select_torch_device(preferred: str) -> str:
    if preferred == "cpu":
        return "cpu"
    """Pick cuda/mps/cpu from real torch capability (prefer GPU when available)."""
    try:
        import torch

        if torch.cuda.is_available():
            return "cuda"
        mps = getattr(torch.backends, "mps", None)
        if mps is not None and mps.is_available():
            return "mps"
    except Exception:
        pass
    _ = preferred
    return "cpu"


def _ensure_model_assets(model_id: str, *, download_missing: bool = False):
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
        # Inference is local only. Provision models explicitly before disconnecting.
        # The library can otherwise download a missing config even with downloads disabled.
        from mel_band_roformer.model_registry import MODEL_REGISTRY
        from mel_band_roformer.download import models_search_dirs

        entry = MODEL_REGISTRY.get(model_id)
        if download_missing and model_id == _CLEAN_MODEL:
            return _download_clean_assets(models_search_dirs()[0])
        if not download_missing:
            for base in models_search_dirs():
                checkpoint, config = base / entry.slug / entry.checkpoint, base / entry.slug / entry.config
                if checkpoint.is_file() and config.is_file():
                    paths = (checkpoint, config)
                    break
            else:
                raise RuntimeError(
                    f"Separation model {model_id} is not cached locally. "
                    "Install the model before using offline separation."
                )
        else:
            paths = ensure_model_assets(model_id)
        from mel_band_roformer.download import _expected_checksum
        for path in paths:
            expected = _CLEAN_HASHES.get(path.name) if model_id == _CLEAN_MODEL else _expected_checksum(path.name)[0]
            if expected:
                if _sha256(path) != expected:
                    raise RuntimeError(f"Separation model integrity check failed: {path.name}. Reinstall this model.")
        return paths


def _load_melband(model_id: str, device: str):
    from .model_resources import require_free_vram
    require_free_vram(device, 1)
    key = f"{model_id}@{device}"
    if key in _MODEL_CACHE:
        _MODEL_CACHE[key]["model"].to(device)
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
    state = torch.load(ckpt_path, map_location="cpu", weights_only=True)
    model.load_state_dict(state)
    model.to(device)
    model.eval()
    bundle = {"model": model, "config": config, "device": device, "model_id": model_id}
    _MODEL_CACHE[key] = bundle
    return bundle


def _resample_audio(audio, source_rate: int, target_rate: int):
    """Resample frames x channels together, preserving channel alignment."""
    import numpy as np
    from scipy.signal import resample_poly

    if source_rate <= 0 or target_rate <= 0:
        raise ValueError("Invalid audio sample rate")
    if source_rate == target_rate:
        return np.asarray(audio, dtype=np.float32)
    divisor = math.gcd(source_rate, target_rate)
    return resample_poly(audio, target_rate // divisor, source_rate // divisor, axis=0).astype(np.float32)


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
    model = None
    completed = False

    try:
        ctx.set_progress(0.15, f"loading Mel-Band RoFormer ({device})")
        bundle = _load_melband(model_id, device)
        model = bundle["model"]
        config = bundle["config"]
        primary = getattr(config.training, "target_instrument", None) or config.training.instruments[0]
        if primary != "vocals":
            raise RuntimeError("A vocal separation checkpoint is required for the vocals output")

        ctx.set_progress(0.35, "reading audio")
        original_mix, sr = sf.read(tmp_in.name, dtype="float32", always_2d=True)
        if not len(original_mix) or original_mix.shape[1] not in (1, 2):
            raise ValueError("Separation requires non-empty mono or stereo audio")
        if not np.isfinite(original_mix).all():
            raise ValueError("Audio contains non-finite samples")
        model_sr = int(config.model.sample_rate)
        mix = _resample_audio(original_mix, sr, model_sr)
        original_mono = original_mix.shape[1] == 1
        if original_mono:
            mix = np.repeat(mix, 2, axis=1)
        mixture = torch.from_numpy(np.ascontiguousarray(mix.T))

        # Check cancellation between model chunks without modifying the dependency.
        class CheckedModel:
            def __call__(self, chunk):
                ctx.raise_if_cancelled()
                output = model(chunk)
                ctx.raise_if_cancelled()
                return output

        ctx.set_progress(0.5, "separating (melband)")
        res, _chunk_time = demix_track(config, CheckedModel(), mixture, device)
        vocals_output = res[primary].T
        if original_mono:
            vocals_output = vocals_output.mean(axis=1, keepdims=True)
        vocals_output = _resample_audio(vocals_output, model_sr, sr)
        # Rational resampling may produce one extra frame. Never shift either stem.
        frames = len(original_mix)
        vocals_output = vocals_output[:frames]
        if len(vocals_output) < frames:
            vocals_output = np.pad(vocals_output, ((0, frames - len(vocals_output)), (0, 0)))
        if not np.isfinite(vocals_output).all():
            raise RuntimeError("Separation produced non-finite audio")
        instrumental = original_mix - vocals_output

        vocals_path = os.path.join(out_dir, "vocals.wav")
        instrumental_path = os.path.join(out_dir, "instrumental.wav")
        # Float WAV prevents independent clipping and preserves mixture reconstruction.
        sf.write(vocals_path, vocals_output, sr, subtype="FLOAT")
        sf.write(instrumental_path, instrumental, sr, subtype="FLOAT")

        stems = {"vocals": vocals_path, "instrumental": instrumental_path}
        ctx.set_progress(0.95, "writing stems")
        completed = True
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
        if model is not None:
            model.to("cpu")
            if device.startswith("cuda"):
                torch.cuda.empty_cache()
        if not completed:
            shutil.rmtree(out_dir, ignore_errors=True)
        try:
            os.unlink(tmp_in.name)
        except OSError:
            pass


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Provision the verified clean vocal separation model")
    parser.add_argument("--download-clean-model", action="store_true", required=True)
    parser.parse_args()
    checkpoint, config = _ensure_model_assets(_CLEAN_MODEL, download_missing=True)
    print(f"Verified clean vocal model: {checkpoint}\nConfig: {config}")
