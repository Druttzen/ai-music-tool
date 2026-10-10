"""Audio correctness tests with deterministic fake inference; no model downloads."""
import io
import sys
from types import SimpleNamespace

import numpy as np
import pytest
import soundfile as sf

from ai_sidecar.jobs import Job, JobContext
from ai_sidecar import stems_melband as stems


def test_demucs_wav_decoder_does_not_require_external_programs(tmp_path):
    from ai_sidecar.stems_separate import _read_demucs_audio
    path = tmp_path / "mono.wav"
    sf.write(path, np.full((4800, 1), 0.25), 48000)
    fake_torch = SimpleNamespace(from_numpy=lambda audio: audio)
    model = SimpleNamespace(samplerate=44100, audio_channels=2)
    result = _read_demucs_audio(path, model, fake_torch)
    assert result.shape == (2, 4410)
    np.testing.assert_array_equal(result[0], result[1])


@pytest.mark.parametrize("sample_rate,channels", [(48000, 2), (16000, 1), (44100, 2)])
def test_model_rate_and_float_stems_preserve_frames_and_reconstruction(monkeypatch, sample_rate, channels):
    calls = []
    model = SimpleNamespace(to=lambda device: calls.append(device))
    config = SimpleNamespace(
        model=SimpleNamespace(sample_rate=44100),
        training=SimpleNamespace(target_instrument="vocals"),
    )
    monkeypatch.setattr(stems, "melband_available", lambda: True)
    monkeypatch.setattr(stems, "build_policy", lambda: SimpleNamespace(device="cpu", as_dict=lambda: {}))
    monkeypatch.setattr(stems, "_select_torch_device", lambda _: "cpu")
    monkeypatch.setattr(stems, "_load_melband", lambda *_: {"model": model, "config": config})
    monkeypatch.setitem(sys.modules, "torch", SimpleNamespace(from_numpy=lambda x: x))

    def demix_track(config, model, audio, device):
        assert audio.shape == (2, 4410)
        # Deliberately exceed PCM range: file writing must not silently clip stems.
        return {"vocals": audio * 3}, 0

    monkeypatch.setitem(sys.modules, "mel_band_roformer", SimpleNamespace(demix_track=demix_track))
    frames = sample_rate // 10
    audio = np.full((frames, channels), 0.75, dtype=np.float32)
    buffer = io.BytesIO()
    sf.write(buffer, audio, sample_rate, format="WAV", subtype="FLOAT")
    result = stems.run_melband_separate(JobContext(Job(job_id="test", kind="stems", payload={"raw": buffer.getvalue()})))
    try:
        vocals, rate = sf.read(result["paths"]["vocals.wav"], always_2d=True, dtype="float32")
        instrumental, _ = sf.read(result["paths"]["instrumental.wav"], always_2d=True, dtype="float32")
        assert rate == sample_rate
        assert vocals.shape == audio.shape == instrumental.shape
        assert sf.info(result["paths"]["vocals.wav"]).subtype == "FLOAT"
        assert vocals.max() > 1
        np.testing.assert_allclose(vocals + instrumental, audio, atol=2e-7)
        assert calls == ["cpu"]
    finally:
        import shutil
        shutil.rmtree(result["out_dir"])


def test_missing_offline_config_does_not_download(monkeypatch, tmp_path):
    entry = SimpleNamespace(slug="test", checkpoint="model.ckpt", config="config.yaml")
    (tmp_path / "test").mkdir()
    (tmp_path / "test" / "model.ckpt").write_bytes(b"checkpoint")
    def forbidden_download(*args, **kwargs):
        pytest.fail("Offline inference attempted a download")
    monkeypatch.setitem(sys.modules, "mel_band_roformer", SimpleNamespace(ensure_model_assets=forbidden_download))
    monkeypatch.setitem(sys.modules, "mel_band_roformer.model_registry", SimpleNamespace(MODEL_REGISTRY=SimpleNamespace(get=lambda _: entry)))
    monkeypatch.setitem(sys.modules, "mel_band_roformer.download", SimpleNamespace(models_search_dirs=lambda: [tmp_path]))
    with pytest.raises(RuntimeError, match="not cached locally"):
        stems._ensure_model_assets("test")


def test_corrupt_download_preserves_existing_model(monkeypatch, tmp_path):
    import urllib.request
    target = tmp_path / stems._CLEAN_MODEL
    target.mkdir()
    existing = target / "test.ckpt"
    existing.write_bytes(b"original")
    monkeypatch.setattr(stems, "_CLEAN_HASHES", {"test.ckpt": "0" * 64})
    monkeypatch.setattr(urllib.request, "urlopen", lambda *args, **kwargs: io.BytesIO(b"corrupt"))
    with pytest.raises(RuntimeError, match="integrity check"):
        stems._download_clean_assets(tmp_path)
    assert existing.read_bytes() == b"original"
    assert list(target.iterdir()) == [existing]
