"""
AI Music Creator — local inference sidecar.

A standalone FastAPI service that the desktop app (Tauri) spawns as a managed
child process. Heavy ML libraries are imported lazily inside the endpoints so
the service starts instantly and `/health` works even before the optional model
stacks (torch/demucs/audiocraft) are installed.

Run standalone:
    uvicorn ai_sidecar.main:app --port 8723

Capability roadmap (Phase B3): analysis (this file) -> stem separation (Demucs)
-> generation (MusicGen / Riffusion) -> singing voice (DiffSinger).
"""

from __future__ import annotations

import io
import os
import tempfile
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, UploadFile, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from pydantic import BaseModel

from .vocal_embed import (
    VocalEmbedPlanEnvelope,
    VocalEmbedPlanResponse,
    accept_vocal_embed_plan,
    vocal_synthesis_available,
)
from .vocal_ml_models import (
    vocal_model_status,
)
from .diffsinger_openvpi import export_ds_bundle_from_plan
from .vocal_align import align_plan_with_guide, mfa_configured
from .vocal_synth import (
    parse_plan_envelope,
    synthesis_stack_available,
    synthesize_vocal_embed_mix,
)
from .youtube_resolve import resolve_youtube_url
from .youtube_sonic import resolve_youtube_audio_sonic
from .sonic_signature import extract_sonic_signature
from .acousticbrainz import fetch_acousticbrainz_features
from .genre_classifier import active_genre_model_id, classify_music_genres
from .vision_analyzer import CLIP_MODEL_ID, MODEL_ID as VISION_MODEL_ID
from .vision_analyzer import caption_image_bytes, clip_tags_for_image_bytes, vision_analysis_available
from .musicgen import active_musicgen_model_id, generation_available
from .cover_generator import active_cover_model_id, cover_available, generate_cover_png
from .cover_ref_generator import (
    active_cover_ref_model_id,
    cover_ref_available,
    generate_cover_from_image_png,
)
from .fail_safe_fix import FixPushRequest, FixPushResponse, fix_push, maintainer_enabled, repo_root
from .fail_safe_runtime import RuntimeDeliverRequest, RuntimeDeliverResponse, deliver_runtime_report
from .device import detect_device, select_device
from .registry import capability_flags, list_capabilities
from .jobs import JOBS
from . import generate_jobs as _generate_jobs  # noqa: F401 — register runners
from . import stems_separate as _stems_separate  # noqa: F401 — register runners
from .stems_separate import separate_audio, stems_available
from .generate_jobs import generate_via_jobs
from .idle import (
    configure_idle_exit,
    hold_dev_session,
    is_activity_path,
    start_idle_watchdog,
    touch_activity,
)

_SIDECAR_TOKEN = os.environ.get("AIMC_SIDECAR_TOKEN", "").strip()
_SIDECAR_AUTH_HEADER = "x-aimc-sidecar-token"

_KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


@asynccontextmanager
async def _lifespan(_app: FastAPI):
    from .vocal_env import load_vocal_env_file

    load_vocal_env_file()
    configure_idle_exit(float(os.environ.get("SIDECAR_IDLE_EXIT_SEC", "300")))
    touch_activity()
    start_idle_watchdog()
    yield


app = FastAPI(
    title="AI Music Creator — AI Sidecar",
    lifespan=_lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:1420",
        "http://127.0.0.1:1420",
        "tauri://localhost",
        "https://tauri.localhost",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def _sidecar_token_auth(request: Request, call_next):
    """When AIMC_SIDECAR_TOKEN is set, require matching header on non-public routes."""
    if not _SIDECAR_TOKEN:
        return await call_next(request)
    if request.method == "OPTIONS":
        return await call_next(request)
    path = request.url.path
    if path in ("/health", "/docs", "/openapi.json", "/redoc"):
        return await call_next(request)
    token = request.headers.get(_SIDECAR_AUTH_HEADER)
    if token != _SIDECAR_TOKEN:
        return JSONResponse(status_code=401, content={"detail": "Invalid or missing sidecar token"})
    return await call_next(request)


@app.middleware("http")
async def _track_sidecar_activity(request: Request, call_next):
    if is_activity_path(request.url.path):
        touch_activity()
    return await call_next(request)


class Health(BaseModel):
    status: str
    device: str
    version: str
    stems_available: bool
    genre_available: bool
    vision_available: bool
    vocal_embed_plan_available: bool
    vocal_synthesis_available: bool
    vocal_ml_available: bool
    vocal_models_available: bool
    vocal_rvc_available: bool
    vocal_diffsinger_available: bool
    generate_available: bool
    cover_available: bool = False
    cover_ref_available: bool = False
    fix_push_available: bool = False
    maintainer_mode: bool = False
    device_info: dict[str, Any] | None = None
    capabilities: list[dict[str, Any]] | None = None
    policy: dict[str, Any] | None = None


class GenrePrediction(BaseModel):
    label: str
    score: float


class Analysis(BaseModel):
    duration_sec: float
    tempo_bpm: float
    key_estimate: str
    key_confidence: float
    spectral_centroid_hz: float
    spectral_bandwidth_hz: float
    spectral_rolloff_hz: float
    onset_strength: float
    beat_count: int
    beat_density: float
    percussive_ratio: float
    harmonic_ratio: float
    device: str
    genre_predictions: list[GenrePrediction] | None = None
    genre_model: str | None = None


class ImageAnalysis(BaseModel):
    caption: str | None = None
    caption_model: str | None = None
    clip_tags: list[GenrePrediction] | None = None
    clip_model: str | None = None
    device: str


class YoutubeResolveRequest(BaseModel):
    url: str


class YoutubeSonicRequest(BaseModel):
    url: str


class YoutubeResolveResponse(BaseModel):
    video_id: str
    watch_url: str
    title: str
    author_name: str
    thumbnail_url: str
    duration_sec: float | None = None
    parsed_artist: str
    parsed_track: str
    search_query: str
    tags: list[str] = []
    categories: list[str] = []
    description_excerpt: str = ""
    provider: str


class ChordPoint(BaseModel):
    time_sec: float
    chord: str
    strength: float


class TimelineSegment(BaseModel):
    start_sec: float
    end_sec: float
    energy: float
    brightness_hz: float


class SonicSignatureResponse(BaseModel):
    duration_sec: float
    tempo_bpm: float
    key_estimate: str
    key_confidence: float
    time_signature: int
    loudness_db: float
    spectral_centroid_hz: float
    harmonic_ratio: float
    percussive_ratio: float
    beat_count: int
    chord_progression: list[ChordPoint]
    timeline_segments: list[TimelineSegment]
    provider: str


class AcousticBrainzResponse(BaseModel):
    recording_mbid: str
    provider: str
    bpm: float | None = None
    key_key: str | None = None
    key_scale: str | None = None
    key_strength: float | None = None
    danceability: float | None = None
    loudness: float | None = None
    moods: list[str] = []
    genres: list[str] = []
    danceability_prob: float | None = None
    voice_instrumental: float | None = None


def _stems_available() -> bool:
    return stems_available()


def _vision_available() -> bool:
    return vision_analysis_available()


@app.get("/health", response_model=Health)
def health() -> Health:
    from . import __version__
    from .device import build_policy

    info = detect_device()
    flags = capability_flags()
    return Health(
        status="ok",
        device=info.device,
        version=__version__,
        stems_available=flags["stems_available"],
        genre_available=flags["genre_available"],
        vision_available=flags["vision_available"],
        vocal_embed_plan_available=flags["vocal_embed_plan_available"],
        vocal_synthesis_available=flags["vocal_synthesis_available"],
        vocal_ml_available=flags["vocal_ml_available"],
        vocal_models_available=flags["vocal_models_available"],
        vocal_rvc_available=flags["vocal_rvc_available"],
        vocal_diffsinger_available=flags["vocal_diffsinger_available"],
        generate_available=flags["generate_available"],
        cover_available=flags["cover_available"],
        cover_ref_available=flags["cover_ref_available"],
        fix_push_available=maintainer_enabled() and bool(repo_root()),
        maintainer_mode=maintainer_enabled(),
        device_info=info.as_dict(),
        capabilities=list_capabilities(),
        policy=build_policy(info).as_dict(),
    )


@app.get("/fail-safe/capabilities")
def fail_safe_capabilities() -> dict[str, bool | str]:
    return {
        "maintainer_mode": maintainer_enabled(),
        "fix_push_available": maintainer_enabled(),
        "runtime_deliver_available": maintainer_enabled(),
        "repo_root": os.environ.get("AIMC_REPO_ROOT", ""),
    }


@app.post("/fail-safe/fix-push", response_model=FixPushResponse)
def fail_safe_fix_push(body: FixPushRequest) -> FixPushResponse:
    return fix_push(body)


@app.post("/fail-safe/runtime-deliver", response_model=RuntimeDeliverResponse)
def fail_safe_runtime_deliver(body: RuntimeDeliverRequest) -> RuntimeDeliverResponse:
    return deliver_runtime_report(body)


@app.post("/youtube/resolve", response_model=YoutubeResolveResponse)
def youtube_resolve(body: YoutubeResolveRequest) -> YoutubeResolveResponse:
    """Resolve YouTube watch URL to public metadata (server-side oEmbed / optional yt-dlp)."""
    try:
        payload = resolve_youtube_url(body.url)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"YouTube resolve failed: {exc}") from exc
    return YoutubeResolveResponse(**payload)


@app.post("/youtube/sonic-signature", response_model=SonicSignatureResponse)
def youtube_sonic_signature(body: YoutubeSonicRequest) -> SonicSignatureResponse:
    """Download YouTube audio via yt-dlp and extract sonic signature (BPM, key, chords)."""
    try:
        payload = resolve_youtube_audio_sonic(body.url)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"YouTube sonic signature failed: {exc}") from exc
    return SonicSignatureResponse(**{k: v for k, v in payload.items() if k not in ("video_id", "watch_url")})


@app.post("/sonic-signature", response_model=SonicSignatureResponse)
async def sonic_signature(file: UploadFile = File(...)) -> SonicSignatureResponse:
    """Rich librosa sonic signature — BPM, key+mode, chord progression, timeline."""
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="empty upload")
    try:
        payload = extract_sonic_signature(raw)
    except Exception as exc:
        if "librosa" in str(exc).lower() or "numpy" in str(exc).lower():
            raise HTTPException(status_code=503, detail=f"analysis deps missing: {exc}") from exc
        raise HTTPException(status_code=422, detail=f"sonic signature failed: {exc}") from exc
    return SonicSignatureResponse(**payload)


@app.get("/acousticbrainz/{recording_mbid}", response_model=AcousticBrainzResponse)
def acousticbrainz_lookup(recording_mbid: str) -> AcousticBrainzResponse:
    """Fetch archived AcousticBrainz features for a MusicBrainz recording MBID."""
    data = fetch_acousticbrainz_features(recording_mbid)
    if not data:
        raise HTTPException(status_code=404, detail="no AcousticBrainz data for this recording")
    return AcousticBrainzResponse(**data)


@app.post("/vocal-embed/plan", response_model=VocalEmbedPlanResponse)
async def vocal_embed_plan(body: VocalEmbedPlanEnvelope) -> VocalEmbedPlanResponse:
    """Validate a Vocal Embed Studio JSON plan from the app."""
    try:
        return accept_vocal_embed_plan(body)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.get("/vocal-embed/models")
def vocal_embed_models() -> dict[str, Any]:
    """Report configured RVC / DiffSinger integrations (models are user-provided)."""
    return vocal_model_status()


@app.post("/vocal-embed/synthesize")
async def vocal_embed_synthesize(
    plan_json: str = Form(...),
    instrumental: UploadFile = File(...),
    guide_vocal: UploadFile | None = File(None),
):
    """Placement-mix v1: duck instrumental under plan sections and overlay guide vocal."""
    if not synthesis_stack_available():
        raise HTTPException(status_code=503, detail="vocal synthesis deps unavailable")

    try:
        plan = parse_plan_envelope(plan_json)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    inst_raw = await instrumental.read()
    if not inst_raw:
        raise HTTPException(status_code=400, detail="empty instrumental upload")

    guide_raw = await guide_vocal.read() if guide_vocal is not None else None
    try:
        wav_bytes, meta = synthesize_vocal_embed_mix(plan, inst_raw, guide_raw)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    tmp.write(wav_bytes)
    tmp.close()
    filename = f"vocal-embed-mix-{meta.get('engine', 'mix')}.wav"
    return FileResponse(
        tmp.name,
        media_type="audio/wav",
        filename=filename,
        headers={"X-Vocal-Embed-Engine": str(meta.get("engine", ""))},
    )


@app.post("/dev-session/ping")
def dev_session_ping() -> dict[str, bool]:
    """Keep the sidecar alive while local dev tools (Next/Tauri/Electron) are running."""
    hold_dev_session(45.0)
    return {"ok": True}


@app.post("/analyze", response_model=Analysis)
async def analyze(file: UploadFile = File(...)) -> Analysis:
    """Real signal analysis with librosa — replaces the JS heuristic analyzer.

    Returns true beat-tracked tempo, a chroma-based key estimate, and spectral
    centroid. This is the first 'real AI/DSP' capability in the migration.
    """
    try:
        import librosa  # noqa: PLC0415
        import numpy as np  # noqa: PLC0415
    except Exception as exc:  # pragma: no cover - depends on optional install
        raise HTTPException(status_code=503, detail=f"analysis deps missing: {exc}") from exc

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="empty upload")

    try:
        y, sr = librosa.load(io.BytesIO(raw), sr=None, mono=True)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"could not decode audio: {exc}") from exc

    duration = float(librosa.get_duration(y=y, sr=sr))
    onset_env = librosa.onset.onset_strength(y=y, sr=sr)
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr, onset_envelope=onset_env)
    tempo_bpm = float(np.atleast_1d(tempo)[0])

    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    chroma_mean = chroma.mean(axis=1)
    key_idx = int(np.argmax(chroma_mean))
    key_total = float(np.sum(chroma_mean)) or 1.0
    key_confidence = float(chroma_mean[key_idx] / key_total)
    centroid = float(np.mean(librosa.feature.spectral_centroid(y=y, sr=sr)))
    bandwidth = float(np.mean(librosa.feature.spectral_bandwidth(y=y, sr=sr)))
    rolloff = float(np.mean(librosa.feature.spectral_rolloff(y=y, sr=sr)))
    onset_strength = float(np.mean(onset_env)) if onset_env.size else 0.0
    beat_count = int(len(beat_frames))
    beat_density = float(beat_count / max(duration, 1.0))
    harmonic, percussive = librosa.effects.hpss(y)
    harmonic_energy = float(np.mean(np.abs(harmonic))) + 1e-9
    percussive_energy = float(np.mean(np.abs(percussive))) + 1e-9
    total_hp = harmonic_energy + percussive_energy

    device = select_device()
    genre_raw = classify_music_genres(y, sr, device=device)
    genre_predictions = (
        [GenrePrediction(label=item["label"], score=item["score"]) for item in genre_raw]
        if genre_raw
        else None
    )

    return Analysis(
        duration_sec=duration,
        tempo_bpm=tempo_bpm,
        key_estimate=_KEYS[key_idx],
        key_confidence=key_confidence,
        spectral_centroid_hz=centroid,
        spectral_bandwidth_hz=bandwidth,
        spectral_rolloff_hz=rolloff,
        onset_strength=onset_strength,
        beat_count=beat_count,
        beat_density=beat_density,
        percussive_ratio=percussive_energy / total_hp,
        harmonic_ratio=harmonic_energy / total_hp,
        device=device,
        genre_predictions=genre_predictions,
        genre_model=active_genre_model_id() if genre_predictions else None,
    )


@app.post("/analyze-image", response_model=ImageAnalysis)
async def analyze_image(
    file: UploadFile = File(...),
    caption: bool = Form(True),
    clip_tags: bool = Form(True),
) -> ImageAnalysis:
    """Optional BLIP captioning + CLIP tags when the vision extra is installed."""
    if not vision_analysis_available():
        raise HTTPException(
            status_code=503,
            detail="vision deps missing — npm run sidecar:vision",
        )

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="empty upload")

    device = select_device()
    text = caption_image_bytes(raw, device=device) if caption else None
    if caption and not text and not clip_tags:
        raise HTTPException(status_code=422, detail="could not caption image")

    clip_raw = clip_tags_for_image_bytes(raw, device=device) if clip_tags else None
    clip_predictions = (
        [GenrePrediction(label=item["label"], score=item["score"]) for item in clip_raw]
        if clip_raw
        else None
    )

    if caption and not text and not clip_predictions:
        raise HTTPException(status_code=422, detail="could not analyze image")

    return ImageAnalysis(
        caption=text,
        caption_model=VISION_MODEL_ID if text else None,
        clip_tags=clip_predictions,
        clip_model=CLIP_MODEL_ID if clip_predictions else None,
        device=device,
    )


class GenerateRequest(BaseModel):
    prompt: str
    duration_sec: float = 10.0


@app.post("/generate")
async def generate_music(body: GenerateRequest):
    """Optional MusicGen text-to-music (requires `generate` extra; CC-BY-NC weights)."""
    if not generation_available():
        raise HTTPException(
            status_code=503,
            detail="generation deps missing — npm run sidecar:generate",
        )

    prompt = str(body.prompt or "").strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="prompt is required")

    try:
        result = generate_via_jobs(prompt, duration_sec=body.duration_sec)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    meta = result.get("meta") or {}
    return FileResponse(
        result["path"],
        media_type="audio/wav",
        filename="musicgen-preview.wav",
        headers={
            "X-MusicGen-Model": str(meta.get("model") or active_musicgen_model_id()),
            "X-MusicGen-Duration-Sec": str(meta.get("duration_sec") or body.duration_sec),
            "X-MusicGen-Mode": str(meta.get("mode") or "text"),
            "X-Job-Id": str(result.get("job_id") or ""),
        },
    )


@app.post("/generate/melody")
async def generate_music_with_melody(
    prompt: str = Form(...),
    duration_sec: float = Form(10.0),
    melody: UploadFile = File(...),
):
    """MusicGen with melody conditioning from a reference WAV/MP3 clip."""
    if not generation_available():
        raise HTTPException(
            status_code=503,
            detail="generation deps missing — npm run sidecar:generate",
        )

    text = str(prompt or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="prompt is required")

    melody_raw = await melody.read()
    if not melody_raw:
        raise HTTPException(status_code=400, detail="empty melody upload")

    try:
        result = generate_via_jobs(text, duration_sec=duration_sec, melody_wav=melody_raw)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    meta = result.get("meta") or {}
    return FileResponse(
        result["path"],
        media_type="audio/wav",
        filename="musicgen-melody-preview.wav",
        headers={
            "X-MusicGen-Model": str(meta.get("model") or active_musicgen_model_id()),
            "X-MusicGen-Duration-Sec": str(meta.get("duration_sec") or duration_sec),
            "X-MusicGen-Mode": "melody",
        },
    )


class CoverRequest(BaseModel):
    prompt: str
    width: int = 1024
    height: int = 1024
    seed: int | None = None
    num_inference_steps: int = 4


@app.post("/cover")
async def generate_cover(body: CoverRequest):
    """Optional FLUX text→album cover (requires `cover` extra)."""
    if not cover_available():
        raise HTTPException(
            status_code=503,
            detail="cover deps missing — npm run sidecar:cover",
        )

    prompt = str(body.prompt or "").strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="prompt is required")

    device = select_device()
    try:
        png, meta = generate_cover_png(
            prompt,
            width=body.width,
            height=body.height,
            seed=body.seed,
            num_inference_steps=body.num_inference_steps,
            device=device,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    return Response(
        content=png,
        media_type="image/png",
        headers={
            "Content-Disposition": 'inline; filename="album-cover.png"',
            "X-Cover-Model": str(meta.get("model") or active_cover_model_id()),
            "X-Cover-Mode": str(meta.get("mode") or "text"),
            "X-Cover-Width": str(meta.get("width") or body.width),
            "X-Cover-Height": str(meta.get("height") or body.height),
        },
    )


@app.post("/cover-ref")
async def generate_cover_ref(
    prompt: str = Form(...),
    strength: float = Form(0.55),
    width: int = Form(1024),
    height: int = Form(1024),
    seed: int | None = Form(None),
    num_inference_steps: int = Form(4),
    image: UploadFile = File(...),
):
    """Optional FLUX img2img cover from a reference image (requires `cover-ref` extra)."""
    if not cover_ref_available():
        raise HTTPException(
            status_code=503,
            detail="cover-ref deps missing — npm run sidecar:cover-ref",
        )

    text = str(prompt or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="prompt is required")

    raw = await image.read()
    if not raw:
        raise HTTPException(status_code=400, detail="empty image upload")

    device = select_device()
    try:
        png, meta = generate_cover_from_image_png(
            raw,
            text,
            strength=strength,
            width=width,
            height=height,
            seed=seed,
            num_inference_steps=num_inference_steps,
            device=device,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    return Response(
        content=png,
        media_type="image/png",
        headers={
            "Content-Disposition": 'inline; filename="album-cover-ref.png"',
            "X-Cover-Model": str(meta.get("model") or active_cover_ref_model_id()),
            "X-Cover-Mode": str(meta.get("mode") or "img2img"),
            "X-Cover-Strength": str(meta.get("strength") or strength),
            "X-Cover-Width": str(meta.get("width") or width),
            "X-Cover-Height": str(meta.get("height") or height),
        },
    )


@app.post("/vocal-embed/align-preview")
async def vocal_embed_align_preview(
    plan_json: str = Form(...),
    guide_vocal: UploadFile = File(...),
) -> dict[str, Any]:
    """Preview per-section word alignment from a guide vocal (MFA or heuristic)."""
    try:
        plan = parse_plan_envelope(plan_json)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    guide_raw = await guide_vocal.read()
    if not guide_raw:
        raise HTTPException(status_code=400, detail="empty guide vocal upload")

    try:
        import librosa  # noqa: PLC0415
        import numpy as np  # noqa: PLC0415
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"alignment deps missing: {exc}") from exc

    y, sr = librosa.load(io.BytesIO(guide_raw), sr=None, mono=True)
    aligned_plan = align_plan_with_guide(plan, np.asarray(y, dtype=np.float32), int(sr))
    method = "mfa" if mfa_configured() else "heuristic"
    sections = aligned_plan.get("sections") or []
    word_count = sum(len(s.get("alignedWords") or []) for s in sections if isinstance(s, dict))
    return {
        "align_method": method,
        "mfa_configured": mfa_configured(),
        "word_count": word_count,
        "sections": sections,
    }


@app.post("/vocal-embed/ds-export")
async def vocal_embed_ds_export(
    plan_json: str = Form(...),
    guide_vocal: UploadFile | None = File(None),
) -> dict[str, Any]:
    """Build OpenVPI DiffSinger `.ds` segment JSON from a vocal embed plan."""
    try:
        plan = parse_plan_envelope(plan_json)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    guide_mono = None
    sample_rate = 44100
    if guide_vocal is not None:
        guide_raw = await guide_vocal.read()
        if guide_raw:
            try:
                import librosa  # noqa: PLC0415
                import numpy as np  # noqa: PLC0415
            except Exception as exc:
                raise HTTPException(status_code=503, detail=f"alignment deps missing: {exc}") from exc
            y, sr = librosa.load(io.BytesIO(guide_raw), sr=None, mono=True)
            guide_mono = np.asarray(y, dtype=np.float32)
            sample_rate = int(sr)

    return export_ds_bundle_from_plan(plan, guide_mono=guide_mono, sample_rate=sample_rate)


class StemFile(BaseModel):
    name: str
    download_url: str
    filename: str


class SeparateResult(BaseModel):
    device: str
    model: str
    sources: list[str]
    job_id: str
    stems: list[StemFile]


@app.get("/separate/download/{job_id}/{filename}")
def separate_download(job_id: str, filename: str):
    """Download one separated stem WAV by job token."""
    JOBS.prune()
    job = JOBS.get(job_id)
    if not job or not job.result:
        raise HTTPException(status_code=404, detail="stem job not found or expired")
    safe = os.path.basename(filename)
    path = (job.result.get("paths") or {}).get(safe)
    if not path or not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="stem file not found")
    return FileResponse(path, media_type="audio/wav", filename=safe)


@app.post("/separate", response_model=SeparateResult)
async def separate(file: UploadFile = File(...), model_name: str = "htdemucs"):
    """Stem separation via Demucs — returns HTTP download URLs for each stem."""
    if not stems_available():
        raise HTTPException(
            status_code=503,
            detail="stem separation unavailable — install the 'stems' extra",
        )

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="empty upload")

    try:
        result = separate_audio(raw, filename=file.filename or "in.wav", model_name=model_name)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"separation failed: {exc}") from exc

    job_id = result["job_id"]
    sources = list(result["sources"])
    stem_files = [
        StemFile(
            name=name,
            filename=f"{name}.wav",
            download_url=f"/separate/download/{job_id}/{name}.wav",
        )
        for name in sources
    ]
    return SeparateResult(
        device=result["device"],
        model=result["model"],
        sources=sources,
        job_id=job_id,
        stems=stem_files,
    )
