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
from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile
from pydantic import BaseModel

app = FastAPI(title="AI Music Creator — AI Sidecar", version="0.1.0")

_KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

# Loaded Demucs models are cached per name to avoid reloading on every request.
_MODEL_CACHE: dict[str, Any] = {}


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


class Analysis(BaseModel):
    duration_sec: float
    tempo_bpm: float
    key_estimate: str
    spectral_centroid_hz: float
    device: str


@app.get("/health", response_model=Health)
def health() -> Health:
    from . import __version__

    return Health(status="ok", device=_select_device(), version=__version__)


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
    tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
    tempo_bpm = float(np.atleast_1d(tempo)[0])

    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    key_idx = int(np.argmax(chroma.mean(axis=1)))
    centroid = float(np.mean(librosa.feature.spectral_centroid(y=y, sr=sr)))

    return Analysis(
        duration_sec=duration,
        tempo_bpm=tempo_bpm,
        key_estimate=_KEYS[key_idx],
        spectral_centroid_hz=centroid,
        device=_select_device(),
    )


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


@app.post("/separate")
async def separate(file: UploadFile = File(...), model_name: str = "htdemucs"):
    """Stem separation via Demucs.

    Returns local file paths for each separated stem (the sidecar is a local
    process, so paths are the cheapest hand-off; the UI reads them directly).
    """
    try:
        from demucs.apply import apply_model  # noqa: PLC0415
        from demucs.audio import AudioFile, save_audio  # noqa: PLC0415
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
            save_audio(source, path, samplerate=model.samplerate)
            stems[name] = path

        return {
            "device": device,
            "model": model_name,
            "sources": list(model.sources),
            "stems": stems,
            "out_dir": out_dir,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"separation failed: {exc}") from exc
    finally:
        try:
            os.unlink(tmp_in.name)
        except OSError:
            pass
