import io

import numpy as np
import pytest
import soundfile as sf

from ai_sidecar.musicgen import encode_musicgen_wav


def test_stereo_phase_is_preserved_instead_of_cancelled_by_mono_downmix():
    left = np.sin(np.arange(3200) * 0.1).astype(np.float32) * 0.4
    wav, meta = encode_musicgen_wav(np.stack([left, -left]), 32000)
    audio, sr = sf.read(io.BytesIO(wav), always_2d=True)
    assert sr == 32000
    assert audio.shape == (3200, 2)
    assert np.max(np.abs(audio[:, 0])) > 0.39
    np.testing.assert_allclose(audio[:, 0], -audio[:, 1], atol=2e-7)
    assert sf.info(io.BytesIO(wav)).subtype == "PCM_24"
    assert meta == {"duration_sec": 0.1, "sample_rate": 32000, "channels": 2, "bit_depth": 24}


def test_peak_reduction_is_linked_across_channels():
    wav, _ = encode_musicgen_wav(np.array([[2.0, -2.0], [1.0, -1.0]]), 48000)
    audio, sr = sf.read(io.BytesIO(wav), always_2d=True)
    assert sr == 48000
    assert np.max(np.abs(audio)) <= 0.950001
    np.testing.assert_allclose(audio[:, 0], 2 * audio[:, 1], atol=2e-7)


@pytest.mark.parametrize("samples", [np.zeros(30), np.array([float("nan")]), np.array([float("inf")]), np.ones((3, 10)), np.array([])])
def test_invalid_or_silent_audio_is_not_reported_as_a_successful_draft(samples):
    with pytest.raises(ValueError):
        encode_musicgen_wav(samples, 32000)
