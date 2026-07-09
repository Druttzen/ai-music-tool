"""Vocal Embed Studio — sidecar plan validation and future synthesis hooks."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class VocalEmbedPlanEnvelope(BaseModel):
    kind: str
    version: int
    createdAt: str
    plan: dict[str, Any]


class VocalEmbedPlanResponse(BaseModel):
    ok: bool
    stage: str
    mode: str
    section_count: int
    message: str
    synthesis_available: bool = False
    next_steps: list[str] = Field(default_factory=list)


def _synthesis_stack_available() -> bool:
    """GPU vocal stacks (DiffSinger/RVC) are opt-in and not bundled in base sidecar."""
    return False


def vocal_synthesis_available() -> bool:
    return _synthesis_stack_available()


def accept_vocal_embed_plan(body: VocalEmbedPlanEnvelope) -> VocalEmbedPlanResponse:
    if body.kind != "vocal_embed_plan":
        raise ValueError("expected kind vocal_embed_plan")
    if body.version != 1:
        raise ValueError(f"unsupported plan version {body.version}")

    plan = body.plan or {}
    stage = str(plan.get("stage") or "draft")
    mode = str(plan.get("sidecarMode") or "lyrics-to-vocal-synthesis")
    sections = plan.get("sections") or []
    section_count = len(sections) if isinstance(sections, list) else 0
    warnings = plan.get("warnings") or []
    synthesis_available = _synthesis_stack_available()

    if stage != "ready":
        missing = warnings if isinstance(warnings, list) and warnings else ["Plan is still in draft mode."]
        raise ValueError("; ".join(str(x) for x in missing[:4]))

    next_steps = [
        "Attach instrumental WAV and optional guide vocal when synthesis stack is enabled.",
        "Run alignment (MFA) when guide vocal + transcript are available.",
        "Apply mix plan ducking and LUFS target before export.",
    ]
    if not synthesis_available:
        next_steps.insert(
            0,
            "Plan accepted — install optional vocal synthesis extra when DiffSinger/RVC integration ships.",
        )

    return VocalEmbedPlanResponse(
        ok=True,
        stage=stage,
        mode=mode,
        section_count=section_count,
        message=f"Accepted vocal embed plan ({section_count} sections, mode={mode}).",
        synthesis_available=synthesis_available,
        next_steps=next_steps,
    )
