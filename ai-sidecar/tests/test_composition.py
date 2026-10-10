"""Learned composer contracts, without downloading or loading weights."""
import json

import httpx
import pytest
from fastapi.testclient import TestClient

from ai_sidecar.composition import plan_composition
from ai_sidecar.jobs import Job, JobContext, JobCancellationRequested
from ai_sidecar.main import app


def mock_api(monkeypatch, *, initialized=True, caption="Learned musical arrangement", fail=False, samples=None):
    monkeypatch.setattr("ai_sidecar.composition.instruction_composer_available", lambda: False)
    calls = []
    def handle(request):
        body = json.loads(request.content) if request.content else {}
        calls.append((request.url.path, body))
        if fail:
            return httpx.Response(503)
        data = {"caption": caption, "lyrics": "[Verse]\nWe chase a dream together",
                "vocal_language": "en",
                "duration": 185, "bpm": 130, "key_scale": "F major", "time_signature": "4"}
        if request.url.path.endswith("model_inventory"):
            data = {"llm_initialized": initialized, "loaded_lm_model": "acestep-5Hz-lm-1.7B" if initialized else None}
        if request.url.path.endswith("create_sample") and samples:
            data = samples.pop(0)
        return httpx.Response(200, json={"code": 200, "data": data})
    real_client = httpx.Client
    monkeypatch.setattr(httpx, "Client", lambda **kwargs: real_client(transport=httpx.MockTransport(handle), **kwargs))
    monkeypatch.setenv("AIMC_ACESTEP_API_URL", "http://127.0.0.1:8001")
    return calls


def test_instrumental_uses_learned_formatter_and_preserves_user_constraints(monkeypatch):
    calls = mock_api(monkeypatch)
    plan = plan_composition("A heroic trance journey", duration_sec=30, bpm=142, key_scale="A minor")
    assert plan["original_prompt"] == "A heroic trance journey"
    assert plan["caption"] == "Learned musical arrangement"
    assert plan["generation_prompt"] == "A heroic trance journey\n\nLearned musical arrangement"
    assert plan["duration_sec"] == 30
    assert plan["suggested_duration_sec"] == 185  # disclosed separately, never replaces 30s
    assert plan["bpm"] == 142 and plan["key_scale"] == "A minor"
    assert plan["planner_model"] == "acestep-5Hz-lm-1.7B"
    assert calls[0][0] == "/format_input"
    assert calls[0][1]["lyrics"] == "[Instrumental]"
    assert json.loads(calls[0][1]["param_obj"])["duration"] == 30
    assert all(path != "/v1/init" for path, _ in calls)


def test_vocal_prompt_creates_lyrics_then_formats_to_duration(monkeypatch):
    calls = mock_api(monkeypatch)
    plan = plan_composition("A song about travel", instrumental=False, duration_sec=60)
    assert [path for path, _ in calls] == ["/v1/create_sample", "/format_input", "/v1/model_inventory"]
    assert plan["method"] == "create-sample+format-input"
    assert not plan["instrumental"]
    assert "60-second song" in calls[0][1]["query"]
    assert "120 words" in calls[0][1]["query"]
    assert calls[0][1]["vocal_language"] == "en"
    assert plan["vocal_language"] == "en"


def test_supplied_lyrics_preserved_as_input_and_imply_vocals(monkeypatch):
    calls = mock_api(monkeypatch)
    plan = plan_composition("Pop", lyrics="[Verse]\nMy own words", instrumental=True)
    assert calls[0][1]["lyrics"] == "[Verse]\nMy own words"
    assert plan["lyrics"] == "[Verse]\nMy own words"
    assert not plan["instrumental"]


@pytest.mark.parametrize("initialized,caption,fail", [(False, "Plan", False), (True, "", False), (True, "Plan", True)])
def test_composer_fails_without_a_real_loaded_planner(monkeypatch, initialized, caption, fail):
    mock_api(monkeypatch, initialized=initialized, caption=caption, fail=fail)
    with pytest.raises(RuntimeError):
        plan_composition("Idea")


def test_cancelled_composition_does_not_contact_api(monkeypatch):
    calls = mock_api(monkeypatch)
    ctx = JobContext(Job("cancel", "generate.acestep", cancel=True))
    with pytest.raises(JobCancellationRequested):
        plan_composition("Idea", check_cancelled=ctx.raise_if_cancelled)
    assert not calls


@pytest.mark.parametrize("duration", [float("nan"), float("inf"), 9, 601])
def test_invalid_composition_duration_rejected(duration):
    with pytest.raises(ValueError):
        plan_composition("Idea", duration_sec=duration)


@pytest.mark.parametrize("lyrics,language", [("word " * 61, "en"), ("[zh] ni3 hao3", "en"), ("你好", "en"), ("Hello dream", "zh")])
def test_wrong_language_or_overlong_generated_lyrics_are_rejected_before_rendering(monkeypatch, lyrics, language):
    sample = {"caption": "Plan", "lyrics": lyrics, "vocal_language": language}
    calls = mock_api(monkeypatch, samples=[sample.copy() for _ in range(3)])
    with pytest.raises(RuntimeError, match="AI lyrics did not fit"):
        plan_composition("English pop", instrumental=False, duration_sec=30)
    assert len(calls) == 3
    assert all(path == "/v1/create_sample" for path, _ in calls)


def test_retry_accepts_short_selected_language_and_preserves_words_after_formatting(monkeypatch):
    bad = {"caption": "Wrong plan", "lyrics": "[zh] ni3 hao3", "vocal_language": "zh"}
    good = {"caption": "Short English pop", "lyrics": "[Chorus]\nWe chase the dream", "vocal_language": "en"}
    calls = mock_api(monkeypatch, samples=[bad, good])
    plan = plan_composition("Pop", instrumental=False, duration_sec=30)
    assert plan["lyrics"] == good["lyrics"]
    assert [path for path, _ in calls] == ["/v1/create_sample", "/v1/create_sample", "/format_input", "/v1/model_inventory"]


def test_job_runner_uses_plan_and_forces_semantic_planning(monkeypatch):
    from ai_sidecar.generate_jobs import run_acestep
    plan = {"caption": "Expanded arrangement", "generation_prompt": "Idea\n\nExpanded arrangement", "lyrics": "[Instrumental]", "duration_sec": 30,
            "bpm": 130, "key_scale": "F major", "vocal_language": "unknown",
            "planner_model": "Qwen3-4B-Q4_K_M", "semantic_model": "acestep-5Hz-lm-1.7B", "time_signature": "4"}
    monkeypatch.setattr("ai_sidecar.acestep_bridge.acestep_configured", lambda: True)
    monkeypatch.setattr("ai_sidecar.acestep_bridge.acestep_reachable", lambda **_: True)
    monkeypatch.setattr("ai_sidecar.composition.plan_composition", lambda *_, **__: plan.copy())
    calls = {}
    def generate(prompt, **kwargs):
        calls.update(kwargs)
        calls["prompt"] = prompt
        return b"RIFF", {"model": "acestep-v15-sft", "lm_model": "acestep-5Hz-lm-1.7B"}
    monkeypatch.setattr("ai_sidecar.acestep_bridge.generate_acestep_song", generate)
    result = run_acestep(JobContext(Job("plan", "generate.acestep", payload={"prompt": "Idea", "compose": True, "thinking": False})))
    try:
        assert calls["prompt"] == "Idea\n\nExpanded arrangement"
        assert calls["thinking"] is True
        assert calls["duration_sec"] == 30
        assert calls["lm_model"] == "acestep-5Hz-lm-1.7B"
        assert result["meta"]["composition_plan"]["reported_lm_model"] == "acestep-5Hz-lm-1.7B"
    finally:
        from ai_sidecar.jobs import cleanup_job_artifacts
        cleanup_job_artifacts(result)


def test_public_plan_contract_and_request_forwarding(monkeypatch):
    captured = {}
    def enqueue(prompt, **options):
        captured.update(options)
        return "composer-job"
    monkeypatch.setattr("ai_sidecar.main.enqueue_song", enqueue)
    client = TestClient(app)
    response = client.post("/generate/song/jobs", json={"prompt": "Idea", "compose": True, "instrumental": False})
    assert response.status_code == 200 and captured["compose"] and not captured["instrumental"]
    mock_api(monkeypatch)
    plan = plan_composition("Idea", duration_sec=30)
    job = Job("composer-job", "generate.acestep", status="done", result={"meta": {"composition_plan": plan}})
    monkeypatch.setattr("ai_sidecar.main.JOBS.get", lambda _: job)
    response = client.get("/generate/song/plan/composer-job")
    assert response.status_code == 200
    assert response.json()["original_prompt"] == "Idea"
    assert "path" not in response.json()
    job.status = "running"
    assert client.get("/generate/song/plan/composer-job").status_code == 404


def test_instruction_plan_is_not_rewritten_by_audio_formatter(monkeypatch):
    calls = mock_api(monkeypatch)
    monkeypatch.setattr("ai_sidecar.composition.instruction_composer_available", lambda: True)
    from test_instruction_composer import proposal
    learned = {**proposal(), "arrangement": ["0–10s verse", "10–30s chorus and ending"], "planner_model": "Qwen3-4B-Q4_K_M", "planner_device": "cuda", "planner_gpu_layers": 37}
    monkeypatch.setattr("ai_sidecar.composition.plan_with_instructions", lambda *args, **kwargs: learned)
    plan = plan_composition("Synthpop dream", duration_sec=30, instrumental=False)
    assert plan["lyrics"] == learned["lyrics"]
    assert plan["semantic_model"] == "acestep-5Hz-lm-1.7B"
    assert plan["planner_model"] == "Qwen3-4B-Q4_K_M"
    assert plan["motif"] in plan["generation_prompt"]
    assert [path for path, _ in calls] == ["/v1/model_inventory"]


def test_instruction_failure_does_not_silently_fall_back(monkeypatch):
    calls = mock_api(monkeypatch)
    monkeypatch.setattr("ai_sidecar.composition.instruction_composer_available", lambda: True)
    def fail(*args, **kwargs): raise RuntimeError("Instruction failure")
    monkeypatch.setattr("ai_sidecar.composition.plan_with_instructions", fail)
    with pytest.raises(RuntimeError, match="Instruction failure"):
        plan_composition("Idea")
    assert not calls


def test_instrumental_language_unknown_is_normalized_when_switching_to_vocals(monkeypatch):
    calls = mock_api(monkeypatch)
    plan = plan_composition("English song", duration_sec=30, instrumental=False, vocal_language="unknown")
    assert calls[0][1]["vocal_language"] == "en"
    assert plan["vocal_language"] == "en"
