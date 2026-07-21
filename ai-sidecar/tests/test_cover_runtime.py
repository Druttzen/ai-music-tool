from __future__ import annotations

from ai_sidecar.cover_runtime import build_cover_policy, place_cover_pipeline
from ai_sidecar.device import DeviceInfo


def _device(backend: str, vram: float = 0.0) -> DeviceInfo:
    return DeviceInfo(
        backend=backend,
        device=backend,
        name=backend,
        total_vram_gb=vram,
        torch_available=True,
    )


class _FakeVae:
    def __init__(self) -> None:
        self.tiling = False

    def enable_tiling(self) -> None:
        self.tiling = True


class _FakePipeline:
    def __init__(self) -> None:
        self.to_device: str | None = None
        self.model_offload = False
        self.sequential_offload = False
        self.vae = _FakeVae()

    def to(self, device: str):
        self.to_device = device
        return self

    def enable_model_cpu_offload(self) -> None:
        self.model_offload = True

    def enable_sequential_cpu_offload(self) -> None:
        self.sequential_offload = True


def test_cover_policy_uses_pure_cpu_without_accelerator_offload():
    policy = build_cover_policy("cpu", info=_device("cpu"))
    pipe = place_cover_pipeline(_FakePipeline(), policy)

    assert policy.dtype == "float32"
    assert pipe.to_device == "cpu"
    assert not pipe.model_offload
    assert not pipe.sequential_offload
    assert pipe.vae.tiling


def test_cover_policy_uses_sequential_offload_on_small_cuda_gpu():
    policy = build_cover_policy("cuda", info=_device("cuda", 8.0))
    pipe = place_cover_pipeline(_FakePipeline(), policy)

    assert policy.enable_sequential_cpu_offload
    assert pipe.sequential_offload
    assert pipe.to_device is None


def test_cover_policy_uses_model_offload_on_midrange_cuda_gpu():
    policy = build_cover_policy("cuda", info=_device("cuda", 24.0))
    pipe = place_cover_pipeline(_FakePipeline(), policy)

    assert policy.enable_model_cpu_offload
    assert pipe.model_offload
    assert pipe.to_device is None


def test_cover_policy_only_fully_places_on_large_cuda_gpu():
    policy = build_cover_policy("cuda", info=_device("cuda", 64.0))
    pipe = place_cover_pipeline(_FakePipeline(), policy)

    assert not policy.enable_model_cpu_offload
    assert not policy.enable_sequential_cpu_offload
    assert pipe.to_device == "cuda"
