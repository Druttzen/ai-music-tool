"""Hardware detection and VRAM-tier policy for sidecar ML stacks.

Torch is imported lazily so /health works before optional ML extras install.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass


@dataclass
class DeviceInfo:
    backend: str  # cuda | mps | cpu
    device: str
    name: str
    total_vram_gb: float
    torch_available: bool
    torch_version: str | None = None
    cuda_version: str | None = None

    def as_dict(self) -> dict:
        return asdict(self)


@dataclass
class DevicePolicy:
    device: str
    dtype: str  # bfloat16 | float16 | float32
    enable_model_cpu_offload: bool
    enable_sequential_cpu_offload: bool
    enable_vae_tiling: bool
    attention_slicing: bool

    def as_dict(self) -> dict:
        return asdict(self)


def detect_device() -> DeviceInfo:
    try:
        import torch
    except Exception:
        return DeviceInfo(
            backend="cpu",
            device="cpu",
            name="CPU (torch not installed)",
            total_vram_gb=0.0,
            torch_available=False,
        )

    if torch.cuda.is_available():
        props = torch.cuda.get_device_properties(0)
        return DeviceInfo(
            backend="cuda",
            device="cuda",
            name=props.name,
            total_vram_gb=round(props.total_memory / (1024**3), 1),
            torch_available=True,
            torch_version=getattr(torch, "__version__", None),
            cuda_version=getattr(getattr(torch, "version", None), "cuda", None),
        )

    mps = getattr(torch.backends, "mps", None)
    if mps is not None and mps.is_available():
        return DeviceInfo(
            backend="mps",
            device="mps",
            name="Apple Metal (MPS)",
            total_vram_gb=0.0,
            torch_available=True,
            torch_version=getattr(torch, "__version__", None),
        )

    return DeviceInfo(
        backend="cpu",
        device="cpu",
        name="CPU",
        total_vram_gb=0.0,
        torch_available=True,
        torch_version=getattr(torch, "__version__", None),
    )


def select_device() -> str:
    """Best device string: cuda → mps → cpu."""
    return detect_device().device


def _bf16_supported() -> bool:
    try:
        import torch

        return bool(torch.cuda.is_available() and torch.cuda.is_bf16_supported())
    except Exception:
        return False


def build_policy(info: DeviceInfo | None = None) -> DevicePolicy:
    info = info or detect_device()

    if info.backend == "cpu":
        return DevicePolicy(
            device="cpu",
            dtype="float32",
            enable_model_cpu_offload=False,
            enable_sequential_cpu_offload=False,
            enable_vae_tiling=True,
            attention_slicing=True,
        )

    if info.backend == "mps":
        return DevicePolicy(
            device="mps",
            dtype="float16",
            enable_model_cpu_offload=False,
            enable_sequential_cpu_offload=False,
            enable_vae_tiling=True,
            attention_slicing=True,
        )

    dtype = "bfloat16" if _bf16_supported() else "float16"
    vram = info.total_vram_gb
    if vram >= 16:
        return DevicePolicy(
            device="cuda",
            dtype=dtype,
            enable_model_cpu_offload=False,
            enable_sequential_cpu_offload=False,
            enable_vae_tiling=True,
            attention_slicing=False,
        )
    if vram >= 10:
        return DevicePolicy(
            device="cuda",
            dtype=dtype,
            enable_model_cpu_offload=True,
            enable_sequential_cpu_offload=False,
            enable_vae_tiling=True,
            attention_slicing=True,
        )
    return DevicePolicy(
        device="cuda",
        dtype=dtype,
        enable_model_cpu_offload=False,
        enable_sequential_cpu_offload=True,
        enable_vae_tiling=True,
        attention_slicing=True,
    )
