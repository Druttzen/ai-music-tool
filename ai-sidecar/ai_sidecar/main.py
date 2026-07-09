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
import secrets
import tempfile
import time
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, UploadFile, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from .vocal_embed import (
    VocalEmbedPlanEnvelope,
    VocalEmbedPlanResponse,
    accept_vocal_embed_plan,
    vocal_ml_available,
    vocal_synthesis_available,
)
from .vocal_ml_models import (
    diffsinger_configured,
    full_ml_vocal_models_available,
    rvc_ready,
    vocal_model_status,
)
from .diffsinger_openvpi import export_ds_bundle_from_plan
from .vocal_align import align_plan_with_guide, mfa_configured
from .vocal_synth import (
    parse_plan_envelope,
    synthesis_stack_available,
    synthesize_vocal_embed_mix,
)
from .genre_classifier import active_genre_model_id, classify_music_genres, genre_classification_available
from .vision_analyzer import CLIP_MODEL_ID, MODEL_ID as VISION_MODEL_ID
from .vision_analyzer import caption_image_bytes, clip_tags_for_image_bytes, vision_analysis_available
from .musicgen import active_musicgen_model_id, generate_music_wav, generation_available
from .idle import (
    configure_idle_exit,
    hold_dev_session,
    is_activity_path,
    start_idle_watchdog,
    touch_activity,
)

_KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

# Loaded Demucs models are cached per name to avoid reloading on every request.
_MODEL_CACHE: dict[str, Any] = {}

# Stem download jobs: token -> { paths: dict[str,str], created: float }
_STEM_JOBS: dict[str, dict[str, Any]] = {}
_STEM_JOB_TTL_SEC = 3600.0


def _prune_stem_jobs() -> None:
    now = time.time()
    expired = [t for t, job in _STEM_JOBS.items() if now - job["created"] > _STEM_JOB_TTL_SEC]
    for token in expired:
        job = _STEM_JOBS.pop(token, None)
        if not job:
            continue
        out_dir = job.get("out_dir")
        if out_dir and os.path.isdir(out_dir):
            for name in os.listdir(out_dir):
                try:
                    os.unlink(os.path.join(out_dir, name))
                except OSError:
                    pass
            try:
                os.rmdir(out_dir)
            except OSError:
                pass


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
    version="0.1.0",
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
async def _track_sidecar_activity(request: Request, call_next):
    if is_activity_path(request.url.path):
        touch_activity()
    return await call_next(request)


def _select_device() -> str:
    """Auto-detect the best available device: CUDA -> Metal (MPS) -> CPU."""
    try:
        import torch  # noqa: PLC0415 (lazy by design)

        if torch.cuda.is_available():
            return "cuda"
        mps = getattr(torch.backends, "mps", None)
        if mps is not None and mps.is_available():
            return "mps"
    except Exception:
        pass
    return "cpu"


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


def _stems_available() -> bool:
    try:
        import demucs  # noqa: F401, PLC0415
    except Exception:
        return False
    return True


def _vision_available() -> bool:
    return vision_analysis_available()


@app.get("/health", response_model=Health)
def health() -> Health:
    from . import __version__

    return Health(
        status="ok",
        device=_select_device(),
        version=__version__,
        stems_available=_stems_available(),
        genre_available=genre_classification_available(),
        vision_available=_vision_available(),
        vocal_embed_plan_available=True,
        vocal_synthesis_available=vocal_synthesis_available(),
        vocal_ml_available=vocal_ml_available(),
        vocal_models_available=full_ml_vocal_models_available(),
        vocal_rvc_available=rvc_ready(),
        vocal_diffsinger_available=diffsinger_configured(),
        generate_available=generation_available(),
    )


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

    device = _select_device()
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
            detail="vision deps missing — pip install -e ai-sidecar[vision]",
        )

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="empty upload")

    device = _select_device()
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
            detail="generation deps missing — pip install -e ai-sidecar[generate]",
        )

    prompt = str(body.prompt or "").strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="prompt is required")

    device = _select_device()
    try:
        wav_bytes, meta = generate_music_wav(
            prompt,
            duration_sec=body.duration_sec,
            device=device,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    tmp.write(wav_bytes)
    tmp.close()
    filename = "musicgen-preview.wav"
    return FileResponse(
        tmp.name,
        media_type="audio/wav",
        filename=filename,
        headers={
            "X-MusicGen-Model": str(meta.get("model") or active_musicgen_model_id()),
            "X-MusicGen-Duration-Sec": str(meta.get("duration_sec") or body.duration_sec),
            "X-MusicGen-Mode": str(meta.get("mode") or "text"),
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
            detail="generation deps missing — pip install -e ai-sidecar[generate]",
        )

    text = str(prompt or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="prompt is required")

    melody_raw = await melody.read()
    if not melody_raw:
        raise HTTPException(status_code=400, detail="empty melody upload")

    device = _select_device()
    try:
        wav_bytes, meta = generate_music_wav(
            text,
            duration_sec=duration_sec,
            melody_wav=melody_raw,
            device=device,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    tmp.write(wav_bytes)
    tmp.close()
    return FileResponse(
        tmp.name,
        media_type="audio/wav",
        filename="musicgen-melody-preview.wav",
        headers={
            "X-MusicGen-Model": str(meta.get("model") or active_musicgen_model_id()),
            "X-MusicGen-Duration-Sec": str(meta.get("duration_sec") or duration_sec),
            "X-MusicGen-Mode": "melody",
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


def _load_demucs(model_name: str):
    """Load (and cache) a pretrained Demucs model onto the best device."""
    import torch  # noqa: PLC0415
    from demucs.pretrained import get_model  # noqa: PLC0415

    if model_name not in _MODEL_CACHE:
        model = get_model(model_name)
        model.to(_select_device())
        model.eval()
        _MODEL_CACHE[model_name] = model
    return _MODEL_CACHE[model_name], torch


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
    _prune_stem_jobs()
    job = _STEM_JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="stem job not found or expired")
    safe = os.path.basename(filename)
    path = job["paths"].get(safe)
    if not path or not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="stem file not found")
    return FileResponse(path, media_type="audio/wav", filename=safe)


def _save_stem_wav(source, path: str, samplerate: int) -> None:
    """Write a Demucs stem tensor to 16-bit WAV via soundfile (no torchcodec)."""
    import numpy as np  # noqa: PLC0415
    import soundfile as sf  # noqa: PLC0415

    if hasattr(source, "detach"):
        data = source.detach().cpu().numpy()
    else:
        data = np.asarray(source)
    if data.ndim == 2:
        data = data.T
    sf.write(path, data, samplerate, subtype="PCM_16")


@app.post("/separate", response_model=SeparateResult)
async def separate(file: UploadFile = File(...), model_name: str = "htdemucs"):
    """Stem separation via Demucs — returns HTTP download URLs for each stem."""
    try:
        from demucs.apply import apply_model  # noqa: PLC0415
        from demucs.audio import AudioFile  # noqa: PLC0415
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=f"stem separation unavailable — install the 'stems' extra ({exc})",
        ) from exc

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="empty upload")

    device = _select_device()
    suffix = os.path.splitext(file.filename or "in.wav")[1] or ".wav"
    tmp_in = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    tmp_in.write(raw)
    tmp_in.close()
    out_dir = tempfile.mkdtemp(prefix="stems_")

    try:
        model, torch = _load_demucs(model_name)

        wav = AudioFile(tmp_in.name).read(
            streams=0, samplerate=model.samplerate, channels=model.audio_channels
        )
        ref = wav.mean(0)
        wav = (wav - ref.mean()) / (ref.std() + 1e-8)

        with torch.no_grad():
            estimates = apply_model(model, wav[None], device=device, progress=False)[0]
        estimates = estimates * (ref.std() + 1e-8) + ref.mean()

        stems: dict[str, str] = {}
        for source, name in zip(estimates, model.sources):
            path = os.path.join(out_dir, f"{name}.wav")
            _save_stem_wav(source, path, model.samplerate)
            stems[name] = path

        _prune_stem_jobs()
        job_id = secrets.token_urlsafe(12)
        _STEM_JOBS[job_id] = {
            "paths": {f"{name}.wav": p for name, p in stems.items()},
            "out_dir": out_dir,
            "created": time.time(),
        }
        stem_files = [
            StemFile(
                name=name,
                filename=f"{name}.wav",
                download_url=f"/separate/download/{job_id}/{name}.wav",
            )
            for name in model.sources
        ]
        return SeparateResult(
            device=device,
            model=model_name,
            sources=list(model.sources),
            job_id=job_id,
            stems=stem_files,
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"separation failed: {exc}") from exc
    finally:
        try:
            os.unlink(tmp_in.name)
        except OSError:
            pass
