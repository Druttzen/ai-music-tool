import numpy as np
import pytest
import soundfile as sf

from ai_sidecar.audio_decode import read_audio


@pytest.mark.parametrize("codec", ["aac", "alac"])
@pytest.mark.parametrize("channels", [1, 2])
def test_m4a_decodes_locally_without_system_ffmpeg(tmp_path, monkeypatch, codec, channels):
    import av
    path = tmp_path / "audio.m4a"
    sample_rate = 48000
    t = np.arange(4800, dtype=np.float32) / sample_rate
    samples = np.stack([np.sin(t * 2 * np.pi * (220 + ch * 220)) * 0.25 for ch in range(channels)])
    layout = "mono" if channels == 1 else "stereo"
    with av.open(str(path), "w") as container:
        stream = container.add_stream(codec, rate=sample_rate)
        stream.layout = layout
        frame = av.AudioFrame.from_ndarray(samples, format="fltp", layout=layout)
        frame.sample_rate = sample_rate
        for packet in stream.encode(frame):
            container.mux(packet)
        for packet in stream.encode(None):
            container.mux(packet)
    monkeypatch.setenv("PATH", "")
    decoded, rate = read_audio(path)
    assert rate == sample_rate
    assert decoded.shape[1] == channels
    assert len(decoded) >= 4800
    assert np.isfinite(decoded).all()
    assert np.sqrt(np.mean(decoded ** 2)) > 0.1
    if channels == 2:
        assert not np.allclose(decoded[:, 0], decoded[:, 1])
    # Upload APIs receive a byte stream, not a filesystem path.
    from ai_sidecar.audio_decode import read_mono_bytes
    mono, mono_rate = read_mono_bytes(path.read_bytes())
    assert mono_rate == rate
    np.testing.assert_allclose(mono, decoded.mean(axis=1), atol=1e-7)


def test_float_wav_is_not_clipped(tmp_path):
    path = tmp_path / "float.wav"
    sf.write(path, np.full((100, 2), 1.25), 44100, subtype="FLOAT")
    decoded, rate = read_audio(path)
    assert rate == 44100
    assert decoded.max() == 1.25


def test_invalid_file_is_an_error_not_silent_audio(tmp_path):
    path = tmp_path / "broken.m4a"
    path.write_bytes(b"not audio")
    with pytest.raises(Exception):
        read_audio(path)
