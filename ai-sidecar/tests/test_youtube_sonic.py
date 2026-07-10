"""Tests for YouTube audio sonic signature."""

from __future__ import annotations

import io
from unittest.mock import patch

import numpy as np
import soundfile as sf

from ai_sidecar.youtube_sonic import resolve_youtube_audio_sonic


def _sine_wav_bytes() -> bytes:
    sr = 22050
    t = np.linspace(0, 1.5, int(sr * 1.5), endpoint=False)
    y = 0.3 * np.sin(2 * np.pi * 440 * t)
    buf = io.BytesIO()
    sf.write(buf, y, sr, format="WAV")
    return buf.getvalue()


@patch("ai_sidecar.youtube_sonic._download_audio_bytes")
def test_resolve_youtube_audio_sonic(mock_dl):
    mock_dl.return_value = _sine_wav_bytes()
    out = resolve_youtube_audio_sonic("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
    assert out["video_id"] == "dQw4w9WgXcQ"
    assert out["tempo_bpm"] > 0
    assert out["provider"] == "librosa+ytdlp"
