"""Vocal Embed optional DSP stack."""

import io

import numpy as np
import pytest

from ai_sidecar.vocal_ml import (
    convert_guide_vocal,
    infer_pitch_shift_semitones,
    ml_vocal_stack_available,
    synthesize_lyrics_vocal,
)


def test_infer_pitch_shift_semitones():
    assert infer_pitch_shift_semitones("warm baritone narrator") == -2.5
    assert infer_pitch_shift_semitones("bright soprano lead") == 5.0
    assert infer_pitch_shift_semitones("neutral studio") == 0.0


@pytest.mark.skipif(not ml_vocal_stack_available(), reason="vocal DSP extra not installed")
def test_synthesize_lyrics_vocal_from_sections():
    plan = {
        "bpm": "120 BPM",
        "key": "A minor",
        "lyrics": "[Verse]\nOne two three\n\n[Chorus]\nHook line",
        "sections": [
            {"name": "Verse", "start": 0.0, "end": 1.0, "lineCount": 1, "text": "[Verse]\nOne two three"},
            {"name": "Chorus", "start": 1.0, "end": 2.0, "lineCount": 1, "text": "[Chorus]\nHook line"},
        ],
    }
    stereo = synthesize_lyrics_vocal(plan, length=88200, sample_rate=44100)
    assert stereo.shape == (2, 88200)
    assert float(np.max(np.abs(stereo))) > 0.01


@pytest.mark.skipif(not ml_vocal_stack_available(), reason="vocal DSP extra not installed")
def test_convert_guide_vocal_changes_signal():
    t = np.linspace(0, 0.5, 22050, endpoint=False, dtype=np.float32)
    mono = (0.3 * np.sin(2 * np.pi * 440 * t)).astype(np.float32)
    stereo = np.stack([mono, mono], axis=0)
    converted = convert_guide_vocal(stereo, 44100, "soprano lead", {})
    assert converted.shape == stereo.shape
    assert not np.allclose(converted, stereo)
