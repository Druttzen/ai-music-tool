"""Validate an optional engine during installation, before recording activation.

Health intentionally discovers packages without importing heavy engines. A pip
success alone cannot validate native extensions or legacy Python compatibility.
These imports run in the install subprocess and never load model checkpoints.
"""
from __future__ import annotations

from importlib import import_module
import os
import subprocess
import sys


ENGINE_IMPORTS = {
    "stems": (("demucs.pretrained", "get_model"), ("demucs.apply", "apply_model")),
    "stems-melband": (("mel_band_roformer", "demix_track"),),
    "generate": (("audiocraft.models", "MusicGen"),),
    "classify": (("transformers", "pipeline"),),
    "vision": (("transformers", "pipeline"), ("PIL.Image", "open")),
    "cover": (("diffusers", "FluxPipeline"),),
    "cover-ref": (("diffusers", "FluxImg2ImgPipeline"),),
    "vocal": (("scipy.signal", "butter"), ("librosa", "load")),
    "vocal-ml": (("torch", "Tensor"), ("torchaudio.functional", "resample"), ("scipy.signal", "butter")),
    "vocal-rvc": (("rvc_python.infer", "RVCInference"),),
}

TORCH_EXTRAS = frozenset(ENGINE_IMPORTS) - {"vocal"}


def prepare_cuda(extra: str) -> None:
    """Restore CUDA wheels after shared-extra resolution on NVIDIA machines."""
    if extra not in TORCH_EXTRAS or os.environ.get("AIMC_FORCE_CPU") == "1":
        return
    flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
    try:
        gpu = subprocess.run(["nvidia-smi", "-L"], capture_output=True, timeout=10, creationflags=flags)
    except (OSError, subprocess.TimeoutExpired):
        return
    if gpu.returncode != 0 or not gpu.stdout.strip():
        return
    probe = [sys.executable, "-c", "import torch; raise SystemExit(0 if torch.cuda.is_available() else 1)"]
    if subprocess.run(probe, capture_output=True, timeout=90, creationflags=flags).returncode == 0:
        return
    index = os.environ.get("AIMC_TORCH_CUDA_INDEX", "").strip() or "https://download.pytorch.org/whl/cu126"
    print(f"Preparing NVIDIA acceleration from {index}", flush=True)
    # Use one wheel index: a newer CPU build on PyPI must not win resolution.
    subprocess.run([sys.executable, "-m", "pip", "install", "--upgrade", "--only-binary=:all:",
                    "torch", "torchaudio", "--index-url", index], check=True, creationflags=flags)
    if subprocess.run(probe, capture_output=True, timeout=90, creationflags=flags).returncode != 0:
        raise RuntimeError("CUDA engine verification failed; NVIDIA acceleration is unavailable after wheel installation")


def verify_extra(extra: str) -> None:
    imports = ENGINE_IMPORTS.get(extra)
    if imports is None:
        raise ValueError(f"Unknown sidecar extra: {extra}")
    for module, symbol in imports:
        try:
            getattr(import_module(module), symbol)
        except Exception as exc:
            raise RuntimeError(
                f"{extra} engine verification failed ({module}.{symbol}): {exc}. "
                "The addon was not activated; installed packages alone are insufficient."
            ) from exc


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--verify", required=True, choices=tuple(ENGINE_IMPORTS))
    parser.add_argument("--prepare-cuda", action="store_true")
    args = parser.parse_args()
    if args.prepare_cuda:
        prepare_cuda(args.verify)
    verify_extra(args.verify)
    print(f"{args.verify} engine import verified", flush=True)
