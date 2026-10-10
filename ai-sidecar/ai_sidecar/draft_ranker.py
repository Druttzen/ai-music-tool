"""Local candidate similarity, not a predictor of production quality or song identity.

CLAP stays on CPU, uses cached weights only, and averages deterministic 10-second
windows. No Suno request, model training, or upload is performed here.
"""
from __future__ import annotations

import io
import threading
from typing import Any

RANKER_MODEL = "laion/clap-htsat-unfused"
_MODEL: Any = None
_PROCESSOR: Any = None
_LOCK = threading.Lock()


def _clap():
    global _MODEL, _PROCESSOR
    if _MODEL is None:
        from transformers import ClapModel, ClapProcessor
        _PROCESSOR = ClapProcessor.from_pretrained(RANKER_MODEL, local_files_only=True)
        _MODEL = ClapModel.from_pretrained(RANKER_MODEL, local_files_only=True).eval().to("cpu")
    return _MODEL, _PROCESSOR


def _unit_vector(features):
    import numpy as np
    if hasattr(features, "pooler_output"):
        features = features.pooler_output
    vector = features.detach().float().cpu().numpy().mean(axis=0)
    norm = float(np.linalg.norm(vector))
    if not np.isfinite(vector).all() or norm < 1e-12:
        raise ValueError("Invalid CLAP embedding")
    return vector / norm


def decode_rank_audio(raw: bytes):
    import librosa
    import numpy as np
    audio, sr = librosa.load(io.BytesIO(raw), sr=48_000, mono=True, duration=60)
    if not audio.size or not np.isfinite(audio).all() or np.max(np.abs(audio)) < 1e-8:
        raise ValueError("Reference audio must contain finite, non-silent samples")
    # Bound work independently of uploaded song length.
    length = 10 * sr
    starts = sorted(set((0, max(0, (len(audio) - length) // 2), max(0, len(audio) - length))))
    return [audio[start:start + length] for start in starts]


def _audio_embedding(raw, model, processor):
    import torch
    inputs = processor(audio=decode_rank_audio(raw), sampling_rate=48_000, return_tensors="pt")
    with torch.inference_mode():
        return _unit_vector(model.get_audio_features(**inputs))


def rank_drafts(prompt: str, audio_files: list[bytes], reference: bytes | None = None) -> dict:
    """Scores are raw cosine similarities. Preserve all takes for human listening."""
    import numpy as np
    # Validate references even if the optional semantic ranker is missing.
    if reference:
        decode_rank_audio(reference)
    try:
        with _LOCK:
            model, processor = _clap()
            import torch
            inputs = processor(text=[prompt], return_tensors="pt", padding=True, truncation=True)
            with torch.inference_mode():
                text_vector = _unit_vector(model.get_text_features(**inputs))
            reference_vector = _audio_embedding(reference, model, processor) if reference else None
            scores = []
            for raw in audio_files:
                vector = _audio_embedding(raw, model, processor)
                text_score = float(np.dot(vector, text_vector))
                ref_score = float(np.dot(vector, reference_vector)) if reference_vector is not None else None
                score = text_score if ref_score is None else 0.6 * text_score + 0.4 * ref_score
                scores.append({"score": score, "prompt_score": text_score, "reference_score": ref_score})
        return {"ranker": RANKER_MODEL, "ranked": True, "note": "CLAP style similarity only; listen for musical quality and structure.", "scores": scores}
    except Exception as exc:
        # Keep successful generations usable when an optional ranker is absent.
        return {"ranker": None, "ranked": False, "note": f"Unranked: cached CLAP unavailable ({type(exc).__name__}). Listen to all takes.", "scores": [{"score": None, "prompt_score": None, "reference_score": None} for _ in audio_files]}
