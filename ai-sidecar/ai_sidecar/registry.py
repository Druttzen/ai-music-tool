"""Capability registry — catalog of optional sidecar stacks (data-driven UI)."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Callable


@dataclass(frozen=True)
class CapabilitySpec:
    id: str
    title: str
    tasks: tuple[str, ...]
    install_hint: str
    license: str
    commercial_use: bool
    probe: Callable[[], bool]

    def snapshot(self) -> dict:
        available = False
        try:
            available = bool(self.probe())
        except Exception:
            available = False
        return {
            "id": self.id,
            "title": self.title,
            "tasks": list(self.tasks),
            "install_hint": self.install_hint,
            "license": self.license,
            "commercial_use": self.commercial_use,
            "available": available,
        }


def _probe_stems() -> bool:
    try:
        import demucs  # noqa: F401
    except Exception:
        return False
    return True


def _probe_generate() -> bool:
    from .musicgen import generation_available

    return generation_available()


def _probe_genre() -> bool:
    from .genre_classifier import genre_classification_available

    return genre_classification_available()


def _probe_vision() -> bool:
    from .vision_analyzer import vision_analysis_available

    return vision_analysis_available()


def _probe_vocal_synth() -> bool:
    from .vocal_embed import vocal_synthesis_available

    return vocal_synthesis_available()


def _probe_vocal_ml() -> bool:
    from .vocal_embed import vocal_ml_available

    return vocal_ml_available()


def _probe_rvc() -> bool:
    from .vocal_ml_models import rvc_ready

    return rvc_ready()


def _probe_diffsinger() -> bool:
    from .vocal_ml_models import diffsinger_configured

    return diffsinger_configured()


CAPABILITIES: tuple[CapabilitySpec, ...] = (
    CapabilitySpec(
        id="stems",
        title="Demucs stem separation",
        tasks=("separate",),
        install_hint="npm run sidecar:stems",
        license="MIT (Demucs)",
        commercial_use=True,
        probe=_probe_stems,
    ),
    CapabilitySpec(
        id="generate",
        title="MusicGen preview",
        tasks=("generate", "generate-melody"),
        install_hint="npm run sidecar:generate",
        license="CC-BY-NC (weights)",
        commercial_use=False,
        probe=_probe_generate,
    ),
    CapabilitySpec(
        id="genre",
        title="Genre classifier",
        tasks=("analyze",),
        install_hint="pip install -e ai-sidecar",
        license="Apache-2.0 / model-dependent",
        commercial_use=True,
        probe=_probe_genre,
    ),
    CapabilitySpec(
        id="vision",
        title="Image caption / CLIP tags",
        tasks=("analyze-image",),
        install_hint="pip install -e ai-sidecar[vision]",
        license="model-dependent",
        commercial_use=True,
        probe=_probe_vision,
    ),
    CapabilitySpec(
        id="vocal_synth",
        title="Vocal embed synthesis",
        tasks=("vocal-embed",),
        install_hint="npm run sidecar:vocal",
        license="project",
        commercial_use=True,
        probe=_probe_vocal_synth,
    ),
    CapabilitySpec(
        id="vocal_ml",
        title="Vocal ML stack",
        tasks=("vocal-ml",),
        install_hint="npm run sidecar:vocal-ml",
        license="model-dependent",
        commercial_use=True,
        probe=_probe_vocal_ml,
    ),
    CapabilitySpec(
        id="rvc",
        title="RVC voice conversion",
        tasks=("rvc",),
        install_hint="npm run sidecar:vocal-ml + RVC models",
        license="model-dependent",
        commercial_use=True,
        probe=_probe_rvc,
    ),
    CapabilitySpec(
        id="diffsinger",
        title="DiffSinger / OpenVPI",
        tasks=("diffsinger",),
        install_hint="Configure DiffSinger paths (see ai-sidecar README)",
        license="model-dependent",
        commercial_use=True,
        probe=_probe_diffsinger,
    ),
)


def list_capabilities() -> list[dict]:
    return [spec.snapshot() for spec in CAPABILITIES]


def capability_flags() -> dict[str, bool]:
    """Legacy boolean flags for Health / older clients."""
    snaps = {c["id"]: c["available"] for c in list_capabilities()}
    return {
        "stems_available": snaps.get("stems", False),
        "genre_available": snaps.get("genre", False),
        "vision_available": snaps.get("vision", False),
        "generate_available": snaps.get("generate", False),
        "vocal_synthesis_available": snaps.get("vocal_synth", False),
        "vocal_ml_available": snaps.get("vocal_ml", False),
        "vocal_rvc_available": snaps.get("rvc", False),
        "vocal_diffsinger_available": snaps.get("diffsinger", False),
        "vocal_models_available": snaps.get("rvc", False) or snaps.get("diffsinger", False),
        "vocal_embed_plan_available": True,
    }


def missing_install_hints() -> list[dict]:
    return [
        {"id": c["id"], "title": c["title"], "install_hint": c["install_hint"]}
        for c in list_capabilities()
        if not c["available"] and c["id"] in ("stems", "generate", "vocal_synth", "vocal_ml", "vision")
    ]
