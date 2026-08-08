"""Vocal Embed Studio — sidecar plan validation and synthesize/align/ds-export hooks."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class VocalEmbedPlanEnvelope(BaseModel):
    kind: str
    version: int
    createdAt: str
    plan: dict[str, Any]
    openvpiDs: dict[str, Any] | None = None


class VocalEmbedPlanResponse(BaseModel):
    ok: bool
    stage: str
    mode: str
    section_count: int
    message: str
    synthesis_available: bool = False
    align_method: str | None = None
    align_word_count: int | None = None
    openvpi_ds_segments: int = 0
    next_steps: list[str] = Field(default_factory=list)


from .vocal_synth import synthesis_stack_available


def vocal_synthesis_available() -> bool:
    return synthesis_stack_available()


def vocal_ml_available() -> bool:
    from .vocal_ml import ml_vocal_stack_available

    return ml_vocal_stack_available()


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
    synthesis_available = vocal_synthesis_available()
    ml_available = vocal_ml_available()
    align_method = plan.get("alignMethod")
    if align_method is not None:
        align_method = str(align_method)
    align_word_count = plan.get("alignWordCount")
    if align_word_count is not None:
        align_word_count = int(align_word_count)
    openvpi_ds = body.openvpiDs if isinstance(body.openvpiDs, dict) else None
    openvpi_ds_segments = 0
    if openvpi_ds and isinstance(openvpi_ds.get("segments"), list):
        openvpi_ds_segments = len(openvpi_ds["segments"])
    elif isinstance(plan.get("openvpiDs"), dict) and isinstance(plan["openvpiDs"].get("segments"), list):
        openvpi_ds_segments = len(plan["openvpiDs"]["segments"])

    if stage != "ready":
        missing = warnings if isinstance(warnings, list) and warnings else ["Plan is still in draft mode."]
        raise ValueError("; ".join(str(x) for x in missing[:4]))

    next_steps = [
        "Attach instrumental WAV and optional guide vocal when synthesis stack is enabled.",
        "Run alignment (MFA) when guide vocal + transcript are available.",
        "Apply mix plan ducking and LUFS target before export.",
    ]
    if synthesis_available:
        next_steps.insert(
            0,
            "POST /vocal-embed/synthesize with instrumental + guide vocal for placement-mix preview.",
        )
        if ml_available:
            next_steps.insert(
                1,
                "Vocal DSP enabled: guide conversion or lyrics-only synthesis without a guide file.",
            )
    else:
        next_steps.insert(
            0,
            "Install sidecar base deps (librosa + soundfile) to enable placement-mix synthesis.",
        )

    if openvpi_ds_segments:
        next_steps.insert(
            0,
            f"OpenVPI .ds export attached ({openvpi_ds_segments} segments) — feed into variance/acoustic inference.",
        )

    return VocalEmbedPlanResponse(
        ok=True,
        stage=stage,
        mode=mode,
        section_count=section_count,
        message=f"Accepted vocal embed plan ({section_count} sections, mode={mode}).",
        synthesis_available=synthesis_available,
        align_method=align_method,
        align_word_count=align_word_count,
        openvpi_ds_segments=openvpi_ds_segments,
        next_steps=next_steps,
    )
