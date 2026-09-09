"""Capability registry — catalog of optional sidecar stacks (data-driven UI)."""

from __future__ import annotations

from dataclasses import dataclass
import importlib.util
import sys
from threading import Lock
from time import monotonic
from typing import Callable


def _module_installed(*names: str) -> bool:
    """True when packages are discoverable — does not import them (health must stay fast)."""
    try:
        return all(importlib.util.find_spec(name) is not None for name in names)
    except (ImportError, ValueError, ModuleNotFoundError):
        return False


@dataclass(frozen=True)
class CapabilitySpec:
    id: str
    title: str
    tasks: tuple[str, ...]
    install_hint: str
    license: str
    commercial_use: bool
    probe: Callable[[], bool]
    # When True, missing stacks are offered for install in the UI
    # (via /health capabilities + missing_install_hints() helper).
    prompt_install: bool = True

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
            "prompt_install": self.prompt_install,
        }


def _probe_stems() -> bool:
    return _module_installed("demucs")


def _probe_stems_melband() -> bool:
    return _module_installed("mel_band_roformer")


def _probe_generate() -> bool:
    return _module_installed("torch", "audiocraft")


def _probe_acestep() -> bool:
    from .acestep_bridge import acestep_configured

    return acestep_configured()


def _probe_mfa() -> bool:
    from .vocal_align import mfa_ready

    return mfa_ready()


def _probe_vocal_transform() -> bool:
    return _module_installed("demucs") or _module_installed("mel_band_roformer")


def _probe_genre() -> bool:
    return _module_installed("torch", "transformers")


def _probe_vision() -> bool:
    return _module_installed("PIL", "torch", "transformers")


def _probe_cover() -> bool:
    return _module_installed("torch", "diffusers", "PIL")


def _probe_cover_ref() -> bool:
    return _module_installed("torch", "diffusers", "PIL")


def _probe_vocal_synth() -> bool:
    return _module_installed("librosa", "soundfile")


def _probe_vocal_ml() -> bool:
    return _module_installed("librosa", "soundfile", "scipy")


def _probe_vocal_torch() -> bool:
    return _module_installed("torch", "torchaudio")


def _probe_rvc() -> bool:
    from .vocal_ml_models import rvc_api_configured

    return rvc_api_configured() or _module_installed("rvc_python")


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
        id="stems-melband",
        title="Mel-Band RoFormer stems",
        tasks=("separate",),
        install_hint="npm run sidecar:stems-melband",
        license="MIT (melband-roformer-infer / Kim weights)",
        commercial_use=True,
        probe=_probe_stems_melband,
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
        id="acestep",
        title="ACE-Step full song",
        tasks=("generate-song",),
        install_hint="Start ACE-Step API + set AIMC_ACESTEP_API_URL (docs/acestep.md)",
        license="MIT (ACE-Step 1.5)",
        commercial_use=True,
        probe=_probe_acestep,
        prompt_install=False,  # external API server, not an npm pip extra
    ),
    CapabilitySpec(
        id="mfa-align",
        title="MFA vocal align",
        tasks=("vocal-align",),
        install_hint="Install MFA + set AIMC_MFA_MODEL/DICT (docs/mfa.md)",
        license="MIT (MFA)",
        commercial_use=True,
        probe=_probe_mfa,
        prompt_install=False,  # external MFA install, not an npm pip extra
    ),
    CapabilitySpec(
        id="vocal-transform",
        title="Vocal region transform",
        tasks=("vocal-transform",),
        install_hint="npm run sidecar:stems (RVC mode also needs sidecar:vocal-rvc)",
        license="project / model-dependent (RVC)",
        commercial_use=True,
        probe=_probe_vocal_transform,
    ),
    CapabilitySpec(
        id="genre",
        title="Genre classifier",
        tasks=("analyze",),
        install_hint="npm run sidecar:classify",
        license="Apache-2.0 / model-dependent",
        commercial_use=True,
        probe=_probe_genre,
    ),
    CapabilitySpec(
        id="vision",
        title="Image caption / CLIP tags",
        tasks=("analyze-image",),
        install_hint="npm run sidecar:vision",
        license="model-dependent",
        commercial_use=True,
        probe=_probe_vision,
    ),
    CapabilitySpec(
        id="cover",
        title="Album cover (FLUX text)",
        tasks=("cover",),
        install_hint="npm run sidecar:cover",
        license="Apache-2.0 (FLUX.1-schnell)",
        commercial_use=True,
        probe=_probe_cover,
    ),
    CapabilitySpec(
        id="cover-ref",
        title="Album cover from image (FLUX img2img)",
        tasks=("cover-ref",),
        install_hint="npm run sidecar:cover-ref",
        license="Apache-2.0 (FLUX.1-schnell)",
        commercial_use=True,
        probe=_probe_cover_ref,
    ),
    CapabilitySpec(
        id="vocal_synth",
        title="Vocal embed synthesis",
        tasks=("vocal-embed",),
        install_hint="npm run sidecar",
        license="project",
        commercial_use=True,
        probe=_probe_vocal_synth,
        prompt_install=False,  # base librosa stack; always on with sidecar
    ),
    CapabilitySpec(
        id="vocal_ml",
        title="Vocal DSP (scipy)",
        tasks=("vocal-dsp",),
        install_hint="npm run sidecar:vocal",
        license="project",
        commercial_use=True,
        probe=_probe_vocal_ml,
    ),
    CapabilitySpec(
        id="vocal-ml",
        title="Vocal ML (torch stack)",
        tasks=("vocal-torch",),
        install_hint="npm run sidecar:vocal-ml",
        license="project",
        commercial_use=True,
        probe=_probe_vocal_torch,
    ),
    CapabilitySpec(
        id="rvc",
        title="RVC voice conversion",
        tasks=("rvc",),
        install_hint="npm run sidecar:vocal-rvc",
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
        prompt_install=False,  # env/config, not an npm extra
    ),
)

_CAPABILITY_CACHE_TTL_SEC = 5.0
_capability_cache_lock = Lock()
_capability_cache: tuple[float, tuple[bool, ...], list[dict]] | None = None


def _optional_module_fingerprint() -> tuple[bool, ...]:
    return tuple(
        name in sys.modules
        for name in ("demucs", "torch", "transformers", "diffusers", "scipy", "rvc_python")
    )


def list_capabilities(*, force_refresh: bool = False) -> list[dict]:
    global _capability_cache
    now = monotonic()
    fingerprint = _optional_module_fingerprint()
    with _capability_cache_lock:
        if (
            not force_refresh
            and _capability_cache is not None
            and now - _capability_cache[0] < _CAPABILITY_CACHE_TTL_SEC
            and fingerprint == _capability_cache[1]
        ):
            return _capability_cache[2]
        snapshot = [spec.snapshot() for spec in CAPABILITIES]
        _capability_cache = (now, fingerprint, snapshot)
        return snapshot


def invalidate_capability_cache() -> None:
    global _capability_cache
    with _capability_cache_lock:
        _capability_cache = None


def capability_flags(capabilities: list[dict] | None = None) -> dict[str, bool]:
    """Legacy boolean flags for Health / older clients."""
    snaps = {
        c["id"]: c["available"]
        for c in (capabilities if capabilities is not None else list_capabilities())
    }
    return {
        "stems_available": snaps.get("stems", False),
        "stems_melband_available": snaps.get("stems-melband", False),
        "genre_available": snaps.get("genre", False),
        "vision_available": snaps.get("vision", False),
        "cover_available": snaps.get("cover", False),
        "cover_ref_available": snaps.get("cover-ref", False),
        "generate_available": snaps.get("generate", False),
        "acestep_available": snaps.get("acestep", False),
        "vocal_transform_available": snaps.get("vocal-transform", False),
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
        if not c["available"] and c.get("prompt_install", True) and c["install_hint"]
    ]
