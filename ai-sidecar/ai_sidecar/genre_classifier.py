"""Optional Hugging Face music-genre classification (GTzan wav2vec2).

Model: dima806/music_genres_classification (Apache-2.0, ~95M params).
Discovered via Hugging Face Hub search for this project's analyzer roadmap.
"""

from __future__ import annotations

from typing import Any

MODEL_ID = "dima806/music_genres_classification"
_TARGET_SR = 16_000

_PIPE: Any = None


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
    global _PIPE
    if _PIPE is not None:
        return _PIPE

    from transformers import pipeline  # noqa: PLC0415

    _PIPE = pipeline(
        "audio-classification",
        model=MODEL_ID,
        device=_pipeline_device(device_name),
    )
    return _PIPE


def classify_music_genres(
    y,
    sr: int,
    *,
    device: str = "cpu",
    top_k: int = 3,
) -> list[dict[str, Any]] | None:
    """Return top-k GTzan genre labels or None when deps/model are unavailable."""
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

        pipe = _get_pipeline(device)
        raw = pipe(
            {"array": np.asarray(audio, dtype=np.float32), "sampling_rate": _TARGET_SR},
            top_k=top_k,
        )
        return [{"label": str(item["label"]), "score": float(item["score"])} for item in raw]
    except Exception:
        return None
