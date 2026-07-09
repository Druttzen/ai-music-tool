"""Optional Hugging Face music-genre classification.

Default model: dima806/music_genres_classification (GTzan wav2vec2, Apache-2.0).
Override with AIMC_GENRE_MODEL, e.g. MarekCech/GenreVim-Music-Classification-DistilHuBERT.
"""

from __future__ import annotations

import os
from typing import Any

DEFAULT_MODEL_ID = "dima806/music_genres_classification"
DISTILHUBERT_MODEL_ID = "MarekCech/GenreVim-Music-Classification-DistilHuBERT"
_TARGET_SR = 16_000

_PIPE: Any = None
_ACTIVE_MODEL_ID: str | None = None


def active_genre_model_id() -> str:
    return os.environ.get("AIMC_GENRE_MODEL", "").strip() or DEFAULT_MODEL_ID


def genre_classification_available() -> bool:
    try:
        import torch  # noqa: F401, PLC0415
        import transformers  # noqa: F401, PLC0415

        return True
    except Exception:
        return False


def _pipeline_device(device_name: str) -> int:
    if device_name != "cuda":
        return -1
    try:
        import torch  # noqa: PLC0415

        return 0 if torch.cuda.is_available() else -1
    except Exception:
        return -1


def _get_pipeline(device_name: str):
    global _PIPE, _ACTIVE_MODEL_ID
    model_id = active_genre_model_id()
    if _PIPE is not None and _ACTIVE_MODEL_ID == model_id:
        return _PIPE, model_id

    from transformers import pipeline  # noqa: PLC0415

    _PIPE = pipeline(
        "audio-classification",
        model=model_id,
        device=_pipeline_device(device_name),
    )
    _ACTIVE_MODEL_ID = model_id
    return _PIPE, model_id


def classify_music_genres(
    y,
    sr: int,
    *,
    device: str = "cpu",
    top_k: int = 3,
) -> list[dict[str, Any]] | None:
    """Return top-k genre labels or None when deps/model are unavailable."""
    if not genre_classification_available():
        return None

    try:
        import librosa  # noqa: PLC0415
        import numpy as np  # noqa: PLC0415

        audio = y
        if sr != _TARGET_SR:
            audio = librosa.resample(audio, orig_sr=sr, target_sr=_TARGET_SR)

        max_samples = _TARGET_SR * 30
        if len(audio) > max_samples:
            start = (len(audio) - max_samples) // 2
            audio = audio[start : start + max_samples]

        pipe, _ = _get_pipeline(device)
        raw = pipe(
            {"array": np.asarray(audio, dtype=np.float32), "sampling_rate": _TARGET_SR},
            top_k=top_k,
        )
        return [{"label": str(item["label"]), "score": float(item["score"])} for item in raw]
    except Exception:
        return None


# Back-compat for imports expecting MODEL_ID constant
MODEL_ID = active_genre_model_id()
