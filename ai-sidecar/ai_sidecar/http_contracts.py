"""Public JSON contracts; filesystem paths remain internal to job artifacts."""

from typing import Literal

from pydantic import BaseModel, ConfigDict

JobState = Literal["queued", "running", "cancellation_requested", "done", "error", "cancelled"]


class CapabilityContract(BaseModel):
    id: str
    title: str
    tasks: list[str]
    install_hint: str
    license: str
    commercial_use: bool
    available: bool
    prompt_install: bool = True


class JobSubmission(BaseModel):
    job_id: str


class JobCancelResponse(JobSubmission):
    status: JobState


class PublicAudioResult(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ready: bool
    model: str | None
    duration_sec: float | None
    mode: str | None
    audio_format: str | None


class PublicJobStatus(BaseModel):
    model_config = ConfigDict(extra="forbid")
    job_id: str
    kind: str
    status: JobState
    progress: float
    message: str
    error: str | None
    result: PublicAudioResult


class AceStepPresetCatalog(BaseModel):
    turbo_model: str
    quality_model: str
    quality_available: bool
    home: str
    note: str
    sft_model: str = "acestep-v15-sft"
    sft_available: bool = False


class DraftCandidate(BaseModel):
    index: int
    seed: int
    score: float | None
    prompt_score: float | None
    reference_score: float | None


class DraftSearchResult(BaseModel):
    selected_index: int
    reference_used: bool
    ranker: str | None
    ranked: bool
    note: str
    candidates: list[DraftCandidate]


class AceStepEnsureResult(BaseModel):
    ok: bool
    url: str


class CompositionPlan(BaseModel):
    model_config = ConfigDict(extra="forbid")
    original_prompt: str
    caption: str
    generation_prompt: str
    lyrics: str
    bpm: int | None
    key_scale: str
    time_signature: str
    duration_sec: float
    suggested_duration_sec: float | None
    vocal_language: str
    instrumental: bool
    planner_model: str
    semantic_model: str | None = None
    planner_device: str | None = None
    planner_gpu_layers: int | None = None
    motif: str | None = None
    harmony: str | None = None
    arrangement: list[str] | None = None
    reported_lm_model: str = ""
    method: str
    semantic_planning_requested: bool


class FailSafeCapabilities(BaseModel):
    maintainer_mode: bool
    fix_push_available: bool
    runtime_deliver_available: bool
    repo_root: str


class OpenVpiStatus(BaseModel):
    root: str | None
    acoustic_exp: str | None
    variance_exp: str | None
    python: str | None
    speaker: str | None
    language: str | None
    configured: bool
    ready: bool


class VocalAlignStatus(BaseModel):
    mfa_configured: bool
    mfa_ready: bool


class VocalModelStatus(BaseModel):
    rvc_python: bool
    rvc_api: bool
    rvc_model_configured: bool
    rvc_ready: bool
    rvc_model: str | None
    rvc_index: str | None
    rvc_models_dir: str | None
    rvc_api_url: str | None
    diffsinger_configured: bool
    diffsinger_ready: bool
    diffsinger_cmd: str | None
    diffsinger_url: str | None
    diffsinger_model_dir: str | None
    diffsinger_openvpi: OpenVpiStatus
    transformers_tts: bool
    models_ready: bool
    align: VocalAlignStatus


class VocalAlignPreviewResponse(VocalAlignStatus):
    align_method: str
    word_count: int
    # Sections are the existing extensible plan dictionaries, not a new plan schema.
    sections: list[dict[str, object]]


class OpenvpiDsExportResponse(BaseModel):
    format: str
    version: int
    align_method: str | None
    segment_count: int
    segments: list[dict[str, str | float]]
