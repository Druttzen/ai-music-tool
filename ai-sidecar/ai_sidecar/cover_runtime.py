"""Shared device placement for optional FLUX cover pipelines.

FLUX is substantially larger than the other sidecar models, so its CUDA
placement needs stricter VRAM thresholds than the generic device policy.
"""

from __future__ import annotations

from dataclasses import replace
from typing import Any

from .device import DeviceInfo, DevicePolicy, build_policy, detect_device


def build_cover_policy(
    device_name: str = "",
    *,
    info: DeviceInfo | None = None,
) -> DevicePolicy:
    """Return a safe FLUX-specific placement policy.

    Full FLUX placement is reserved for unusually large GPUs. Mid-tier cards
    use model offload and smaller cards use sequential offload. Explicit CPU
    and MPS requests never install accelerator-offload hooks.
    """
    detected = info or detect_device()
    requested = str(device_name or detected.device or "cpu").strip().lower()

    if requested == "cuda" and detected.backend == "cuda":
        base = build_policy(detected)
        if detected.total_vram_gb >= 48:
            return replace(
                base,
                enable_model_cpu_offload=False,
                enable_sequential_cpu_offload=False,
            )
        if detected.total_vram_gb >= 16:
            return replace(
                base,
                enable_model_cpu_offload=True,
                enable_sequential_cpu_offload=False,
                attention_slicing=True,
            )
        return replace(
            base,
            enable_model_cpu_offload=False,
            enable_sequential_cpu_offload=True,
            attention_slicing=True,
        )

    if requested == "mps" and detected.backend == "mps":
        return DevicePolicy(
            device="mps",
            dtype="float16",
            enable_model_cpu_offload=False,
            enable_sequential_cpu_offload=False,
            enable_vae_tiling=True,
            attention_slicing=True,
        )

    return DevicePolicy(
        device="cpu",
        dtype="float32",
        enable_model_cpu_offload=False,
        enable_sequential_cpu_offload=False,
        enable_vae_tiling=True,
        attention_slicing=True,
    )


def torch_dtype_for_policy(torch_module: Any, policy: DevicePolicy):
    """Resolve the configured dtype lazily after torch is imported."""
    if policy.dtype == "bfloat16":
        return torch_module.bfloat16
    if policy.dtype == "float16":
        return torch_module.float16
    return torch_module.float32


def place_cover_pipeline(pipe: Any, policy: DevicePolicy):
    """Place a pipeline according to policy and return it."""
    if policy.device == "cuda" and policy.enable_sequential_cpu_offload:
        pipe.enable_sequential_cpu_offload()
    elif policy.device == "cuda" and policy.enable_model_cpu_offload:
        pipe.enable_model_cpu_offload()
    else:
        pipe = pipe.to(policy.device)

    vae = getattr(pipe, "vae", None)
    if policy.enable_vae_tiling and vae is not None and hasattr(vae, "enable_tiling"):
        vae.enable_tiling()
    return pipe


def generator_device_for_policy(policy: DevicePolicy) -> str:
    """CPU generators are portable across offloaded and MPS pipelines."""
    if policy.device == "cuda" and not (
        policy.enable_model_cpu_offload or policy.enable_sequential_cpu_offload
    ):
        return "cuda"
    return "cpu"
