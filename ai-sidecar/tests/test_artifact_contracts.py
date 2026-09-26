"""Contract tests for sidecar job artifact results."""

import pytest

from ai_sidecar.artifact_contracts import (
    ArtifactContractError,
    normalize_audio_result,
    normalize_stems_result,
    normalize_vocal_transform_result,
)


def test_audio_result_contract_normalizes_required_fields():
    result = normalize_audio_result(
        {
            "path": "/tmp/song.wav",
            "model": "musicgen-small",
            "meta": {"duration_sec": 8.0, "mode": "text"},
            "device": "cpu",
        }
    )
    assert result["artifact_type"] == "audio"
    assert result["path"] == "/tmp/song.wav"
    assert result["model"] == "musicgen-small"
    assert result["meta"]["duration_sec"] == 8.0


def test_audio_result_contract_rejects_missing_path():
    with pytest.raises(ArtifactContractError, match="path"):
        normalize_audio_result({"model": "musicgen"})


@pytest.mark.parametrize("meta", [None, "invalid"])
def test_audio_result_contract_rejects_missing_or_invalid_meta(meta):
    with pytest.raises(ArtifactContractError, match="meta"):
        normalize_audio_result({"path": "/tmp/song.wav", "meta": meta})


def test_stems_result_contract_requires_paths_and_output_dir():
    result = normalize_stems_result(
        {
            "paths": {"vocals.wav": "/tmp/stems/vocals.wav"},
            "out_dir": "/tmp/stems",
            "model": "htdemucs",
            "backend": "demucs",
            "sources": ["vocals"],
        }
    )
    assert result["artifact_type"] == "stems"
    assert result["paths"]["vocals.wav"].endswith("vocals.wav")
    assert result["out_dir"] == "/tmp/stems"


@pytest.mark.parametrize("sources", [None, "vocals", []])
def test_stems_result_contract_rejects_missing_or_invalid_sources(sources):
    with pytest.raises(ArtifactContractError, match="sources"):
        normalize_stems_result(
            {
                "paths": {"vocals.wav": "/tmp/stems/vocals.wav"},
                "out_dir": "/tmp/stems",
                "sources": sources,
            }
        )


def test_vocal_transform_contract_preserves_parallel_outputs():
    result = normalize_vocal_transform_result(
        {
            "mode": "pitch",
            "sample_rate": 44100,
            "regions": [{"start_sec": 1.0, "end_sec": 2.0}],
            "model": "htdemucs",
            "device": "cpu",
            "vocals_path": "/tmp/vocal_xf/vocals-transformed.wav",
            "remix_path": "/tmp/vocal_xf/remix-transformed.wav",
            "out_dir": "/tmp/vocal_xf",
        }
    )
    assert result["artifact_type"] == "vocal_transform"
    assert result["vocals_path"]
    assert result["remix_path"]
    assert result["sample_rate"] == 44100


def test_vocal_transform_contract_requires_at_least_one_audio_output():
    with pytest.raises(ArtifactContractError, match="audio output"):
        normalize_vocal_transform_result(
            {
                "mode": "pitch",
                "sample_rate": 44100,
                "regions": [],
                "out_dir": "/tmp/vocal_xf",
            }
        )
