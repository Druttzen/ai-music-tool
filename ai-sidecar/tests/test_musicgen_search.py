import io
import sys
from contextlib import nullcontext
from pathlib import Path
from types import SimpleNamespace

import numpy as np
import pytest
import soundfile as sf
from fastapi.testclient import TestClient

from ai_sidecar import draft_ranker, musicgen_search
from ai_sidecar.jobs import Job, JobContext, JobCancellationRequested, cleanup_job_artifacts
from ai_sidecar.main import app


def tone():
    audio = np.sin(np.arange(4800) / 48000 * 2 * np.pi * 440).astype(np.float32) * 0.1
    output = io.BytesIO()
    sf.write(output, audio, 48000, format="WAV")
    return output.getvalue()


def test_seeds_are_explicit_distinct_and_bounded():
    assert musicgen_search.draft_seeds(2147483647, 3) == [2147483647, 0, 1]
    assert musicgen_search.draft_seeds(123, 3) == [123, 124, 125]
    with pytest.raises(ValueError):
        musicgen_search.draft_seeds(2, 9)
    with pytest.raises(ValueError):
        musicgen_search.draft_seeds(-1, 3)


def test_ranker_missing_keeps_unranked_candidates(monkeypatch):
    def unavailable():
        raise OSError("not cached")
    monkeypatch.setattr(draft_ranker, "_clap", unavailable)
    result = draft_ranker.rank_drafts("pop", [tone(), tone()])
    assert not result["ranked"]
    assert result["ranker"] is None
    assert [score["score"] for score in result["scores"]] == [None, None]
    assert "Unranked" in result["note"]


def test_invalid_reference_is_not_reported_as_ranker_unavailable():
    raw = io.BytesIO()
    sf.write(raw, np.zeros(4800), 48000, format="WAV")
    with pytest.raises(ValueError, match="non-silent"):
        draft_ranker.rank_drafts("pop", [tone()], raw.getvalue())


def test_ranker_scores_prompt_and_reference_separately(monkeypatch):
    monkeypatch.setitem(sys.modules, "torch", SimpleNamespace(inference_mode=nullcontext))
    model = SimpleNamespace(get_text_features=lambda **_: np.array([1., 0.]))
    monkeypatch.setattr(draft_ranker, "_clap", lambda: (model, lambda **_: {}))
    monkeypatch.setattr(draft_ranker, "_unit_vector", lambda value: value)
    monkeypatch.setattr(draft_ranker, "decode_rank_audio", lambda _: [])
    vectors = {b"reference": np.array([0., 1.]), b"a": np.array([1., 0.]), b"b": np.array([0.6, 0.8])}
    monkeypatch.setattr(draft_ranker, "_audio_embedding", lambda raw, *_: vectors[raw])
    ranked = draft_ranker.rank_drafts("style", [b"a", b"b"], b"reference")
    assert ranked["ranked"] is True
    assert ranked["scores"][0] == {"score": 0.6, "prompt_score": 1., "reference_score": 0.}
    assert ranked["scores"][1]["score"] == pytest.approx(0.68)
    assert ranked["scores"][1]["reference_score"] == pytest.approx(0.8)
    prompt_only = draft_ranker.rank_drafts("style", [b"a", b"b"])
    assert prompt_only["scores"][0]["score"] == 1.
    assert prompt_only["scores"][1]["reference_score"] is None


def test_search_selects_scored_seed_keeps_all_audio_and_prunes(monkeypatch):
    seeds = []
    def generate(prompt, **kwargs):
        seeds.append(kwargs["seed"])
        return tone(), {"model": "facebook/musicgen-stereo-medium", "duration_sec": 0.1, "mode": "text"}
    monkeypatch.setattr(musicgen_search, "generate_music_wav", generate)
    monkeypatch.setattr(draft_ranker, "rank_drafts", lambda *_: {
        "ranker": "test", "ranked": True, "note": "similarity", "scores": [
            {"score": s, "prompt_score": s, "reference_score": None} for s in [0.2, 0.8, 0.4]],
    })
    job = Job("test", "generate.musicgen.search", payload={"prompt": "pop", "seed": 123, "duration_sec": 5})
    result = musicgen_search.run_draft_search(JobContext(job))
    search = result["meta"]["draft_search"]
    assert seeds == [123, 124, 125]
    assert search["selected_index"] == 1
    assert result["path"] == search["candidates"][1]["path"]
    assert all(Path(item["path"]).is_file() for item in search["candidates"])
    cleanup_job_artifacts(result)
    assert not any(Path(item["path"]).exists() for item in search["candidates"])


def test_cancel_stops_before_inference(monkeypatch):
    monkeypatch.setattr(musicgen_search, "generate_music_wav", lambda *_, **__: pytest.fail("inference started"))
    job = Job("test", "generate.musicgen.search", cancel=True, payload={"seed": 1, "duration_sec": 5})
    with pytest.raises(JobCancellationRequested):
        musicgen_search.run_draft_search(JobContext(job))


def test_public_search_hides_paths_and_audio_requires_valid_index(monkeypatch):
    job = Job("test", "generate.musicgen.search", status="done", result={
        "path": "private/audio.wav", "meta": {"draft_search": {
            "selected_index": 0, "ranker": None, "ranked": False, "reference_used": False,
            "note": "unranked", "candidates": [{"index": 0, "seed": 12, "path": "private/audio.wav",
                "score": None, "prompt_score": None, "reference_score": None}],
        }},
    })
    monkeypatch.setattr("ai_sidecar.main.JOBS.get", lambda _: job)
    response = TestClient(app).get("/generate/drafts/test")
    assert response.status_code == 200
    assert "private" not in response.text
    assert response.json()["candidates"][0]["seed"] == 12
    assert TestClient(app).get("/generate/audio/test?candidate_index=4").status_code == 404


def test_multipart_search_rejects_invalid_bounds_before_queuing():
    response = TestClient(app).post("/generate/drafts/jobs", data={"prompt": "pop", "candidate_count": "8"})
    assert response.status_code == 422
