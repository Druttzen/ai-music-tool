"""Unit tests for ACE-Step bridge helpers (no live API required)."""

import json

import pytest

from ai_sidecar.acestep_bridge import (
    acestep_configured,
    acestep_reachable,
    build_release_task_payload,
    normalize_song_format,
    parse_query_result,
    parse_task_submit,
)


def test_normalize_song_format():
    assert normalize_song_format("WAV") == "wav"
    assert normalize_song_format("mp3") == "mp3"
    assert normalize_song_format("nope") == "wav"
    assert normalize_song_format(None) == "wav"


def test_build_release_task_payload_basic(monkeypatch):
    monkeypatch.delenv("AIMC_ACESTEP_MODEL", raising=False)
    monkeypatch.delenv("AIMC_ACESTEP_API_KEY", raising=False)
    payload = build_release_task_payload(
        "upbeat pop",
        lyrics="[Verse]\nHello",
        duration_sec=120,
        bpm=128,
        key_scale="C Major",
        vocal_language="en",
    )
    assert payload["prompt"] == "upbeat pop"
    assert payload["lyrics"].startswith("[Verse]")
    assert payload["audio_duration"] == 120
    assert payload["bpm"] == 128
    assert payload["key_scale"] == "C Major"
    assert payload["vocal_language"] == "en"
    assert payload["thinking"] is True
    assert payload["batch_size"] == 1
    assert "model" not in payload
    assert "ai_token" not in payload


def test_build_release_task_payload_clamps_and_auth(monkeypatch):
    monkeypatch.setenv("AIMC_ACESTEP_MODEL", "acestep-v15-turbo")
    monkeypatch.setenv("AIMC_ACESTEP_API_KEY", "secret")
    payload = build_release_task_payload("x", duration_sec=5)
    assert payload["audio_duration"] == 10.0  # min clamp
    assert payload["model"] == "acestep-v15-turbo"
    assert payload["ai_token"] == "secret"

    payload_long = build_release_task_payload("x", duration_sec=9999)
    assert payload_long["audio_duration"] == 600.0


def test_build_release_task_payload_requires_prompt():
    with pytest.raises(ValueError, match="prompt"):
        build_release_task_payload("  ")


def test_parse_task_submit():
    assert parse_task_submit({"data": {"task_id": "abc123"}, "code": 200}) == "abc123"
    with pytest.raises(RuntimeError, match="task submit failed"):
        parse_task_submit({"data": {}, "error": "busy"})


def test_parse_query_result_stringified():
    result = [
        {
            "file": "/v1/audio?path=%2Ftmp%2Fsong.wav",
            "status": 1,
            "metas": {"bpm": 120, "duration": 30, "keyscale": "Am"},
            "dit_model": "acestep-v15-turbo",
        }
    ]
    body = {
        "data": [
            {
                "task_id": "abc",
                "status": 1,
                "result": json.dumps(result),
            }
        ]
    }
    parsed = parse_query_result(body)
    assert parsed["status"] == 1
    assert parsed["file"].startswith("/v1/audio")
    assert parsed["dit_model"] == "acestep-v15-turbo"
    assert parsed["metas"]["bpm"] == 120


def test_parse_query_result_running():
    assert parse_query_result({"data": [{"status": 0, "result": ""}]})["status"] == 0
    assert parse_query_result({})["status"] == 0


def test_acestep_reachable_requires_url(monkeypatch):
    monkeypatch.delenv("AIMC_ACESTEP_API_URL", raising=False)
    assert acestep_configured() is False
    assert acestep_reachable() is False


def test_acestep_reachable_probes_http(monkeypatch):
    monkeypatch.setenv("AIMC_ACESTEP_API_URL", "http://127.0.0.1:18001")
    assert acestep_configured() is True

    class _Resp:
        status = 200

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

    def fake_urlopen(req, timeout=1.5):  # noqa: ARG001
        return _Resp()

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)
    assert acestep_reachable() is True


def test_acestep_reachable_false_when_offline(monkeypatch):
    import urllib.error

    monkeypatch.setenv("AIMC_ACESTEP_API_URL", "http://127.0.0.1:18001")

    def boom(*args, **kwargs):  # noqa: ARG001
        raise urllib.error.URLError("down")

    monkeypatch.setattr("urllib.request.urlopen", boom)
    assert acestep_reachable() is False
