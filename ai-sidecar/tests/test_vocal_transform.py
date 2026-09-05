"""Unit tests for vocal region transform helpers (no Demucs required)."""

import numpy as np
import pytest

from ai_sidecar.vocal_transform import (
    normalize_mode,
    normalize_output,
    parse_regions,
    transform_vocal_regions,
)


def test_normalize_mode_and_output():
    assert normalize_mode("RVC") == "rvc"
    assert normalize_mode("nope") == "pitch"
    assert normalize_output("vocals") == "vocals"
    assert normalize_output("") == "both"


def test_parse_regions():
    assert parse_regions(None) == []
    assert parse_regions([{"start_sec": 1.0, "end_sec": 3.5}]) == [(1.0, 3.5)]
    assert parse_regions([{"start": 2, "end": 1}]) == []  # end <= start
    assert parse_regions([{"start_sec": 4, "end_sec": 5}, {"start_sec": 1, "end_sec": 2}]) == [
        (1.0, 2.0),
        (4.0, 5.0),
    ]


def test_transform_vocal_regions_pitch_changes_selected_window():
    sr = 22050
    t = np.linspace(0, 1.0, sr, dtype=np.float32)
    mono = (0.2 * np.sin(2 * np.pi * 220 * t)).astype(np.float32)
    out = transform_vocal_regions(
        mono,
        sr,
        [(0.2, 0.5)],
        mode="pitch",
        pitch_semitones=4.0,
    )
    assert out.shape == mono.shape
    # Untouched head should match; mid window should differ.
    assert np.allclose(out[: int(0.15 * sr)], mono[: int(0.15 * sr)], atol=1e-5)
    mid = slice(int(0.3 * sr), int(0.4 * sr))
    assert not np.allclose(out[mid], mono[mid], atol=1e-3)


def test_transform_vocal_regions_full_track_when_empty():
    sr = 8000
    mono = np.random.default_rng(0).standard_normal(sr).astype(np.float32) * 0.1
    out = transform_vocal_regions(mono, sr, [], mode="robot")
    assert out.shape == mono.shape
    assert not np.allclose(out, mono)
