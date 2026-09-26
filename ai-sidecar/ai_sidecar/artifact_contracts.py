"""Internal contracts for job-produced artifacts.

These contracts normalize runner results without changing public HTTP routes.
They intentionally model artifact families instead of introducing one universal
artifact object for every sidecar operation.
"""

from __future__ import annotations

from typing import Any, NotRequired, TypedDict


class ArtifactContractError(ValueError):
    """Raised when a runner result violates its internal artifact contract."""


class AudioArtifactResult(TypedDict):
    artifact_type: str
    path: str
    model: NotRequired[str | None]
    device: NotRequired[str | None]
    meta: dict[str, Any]
    audio_format: NotRequired[str | None]


class StemsArtifactResult(TypedDict):
    artifact_type: str
    paths: dict[str, str]
    out_dir: str
    model: NotRequired[str | None]
    backend: NotRequired[str | None]
    device: NotRequired[str | None]
    sources: list[str]
    policy: NotRequired[dict[str, Any]]


class VocalTransformArtifactResult(TypedDict):
    artifact_type: str
    mode: str
    sample_rate: int
    regions: list[dict[str, float]]
    out_dir: str
    model: NotRequired[str | None]
    device: NotRequired[str | None]
    vocals_path: NotRequired[str | None]
    remix_path: NotRequired[str | None]


def _required_text(result: dict[str, Any], key: str) -> str:
    value = result.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ArtifactContractError(f"{key} is required")
    return value


def normalize_audio_result(result: dict[str, Any]) -> AudioArtifactResult:
    path = _required_text(result, "path")
    meta = result.get("meta")
    if not isinstance(meta, dict):
        meta = {}
    return {
        "artifact_type": "audio",
        "path": path,
        "model": result.get("model") if isinstance(result.get("model"), str) else None,
        "device": result.get("device") if isinstance(result.get("device"), str) else None,
        "meta": meta,
        "audio_format": result.get("audio_format")
        if isinstance(result.get("audio_format"), str)
        else None,
    }


def normalize_stems_result(result: dict[str, Any]) -> StemsArtifactResult:
    paths = result.get("paths")
    if not isinstance(paths, dict) or not paths:
        raise ArtifactContractError("paths is required")
    normalized_paths = {
        str(name): str(path)
        for name, path in paths.items()
        if isinstance(path, str) and path.strip()
    }
    if not normalized_paths:
        raise ArtifactContractError("paths must contain audio artifact paths")
    out_dir = _required_text(result, "out_dir")
    sources = result.get("sources")
    if not isinstance(sources, list):
        sources = []
    return {
        "artifact_type": "stems",
        "paths": normalized_paths,
        "out_dir": out_dir,
        "model": result.get("model") if isinstance(result.get("model"), str) else None,
        "backend": result.get("backend") if isinstance(result.get("backend"), str) else None,
        "device": result.get("device") if isinstance(result.get("device"), str) else None,
        "sources": [str(source) for source in sources],
        "policy": result.get("policy") if isinstance(result.get("policy"), dict) else {},
    }


def normalize_vocal_transform_result(result: dict[str, Any]) -> VocalTransformArtifactResult:
    mode = _required_text(result, "mode")
    out_dir = _required_text(result, "out_dir")
    sample_rate = result.get("sample_rate")
    if not isinstance(sample_rate, int) or sample_rate <= 0:
        raise ArtifactContractError("sample_rate is required")
    regions = result.get("regions")
    if not isinstance(regions, list):
        raise ArtifactContractError("regions is required")

    vocals_path = result.get("vocals_path")
    remix_path = result.get("remix_path")
    if not (
        isinstance(vocals_path, str)
        and vocals_path.strip()
        or isinstance(remix_path, str)
        and remix_path.strip()
    ):
        raise ArtifactContractError("at least one audio output is required")

    normalized_regions: list[dict[str, float]] = []
    for region in regions:
        if not isinstance(region, dict):
            raise ArtifactContractError("regions must contain objects")
        try:
            normalized_regions.append(
                {
                    "start_sec": float(region["start_sec"]),
                    "end_sec": float(region["end_sec"]),
                }
            )
        except (KeyError, TypeError, ValueError) as exc:
            raise ArtifactContractError("regions must contain start_sec/end_sec") from exc

    return {
        "artifact_type": "vocal_transform",
        "mode": mode,
        "sample_rate": sample_rate,
        "regions": normalized_regions,
        "out_dir": out_dir,
        "model": result.get("model") if isinstance(result.get("model"), str) else None,
        "device": result.get("device") if isinstance(result.get("device"), str) else None,
        "vocals_path": vocals_path if isinstance(vocals_path, str) else None,
        "remix_path": remix_path if isinstance(remix_path, str) else None,
    }
