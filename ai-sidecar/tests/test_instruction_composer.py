import json

import pytest

from ai_sidecar.instruction_composer import plan_schema, validate_plan, _stream_json


def proposal():
    return dict(caption="Synthpop", motif="Three-note hook", harmony="Am F C G",
                arrangement=[dict(start_sec=0, end_sec=10, direction="verse"), dict(start_sec=10, end_sec=30, direction="chorus and ending")], bpm=120,
                key_scale="A minor", time_signature="4", vocal_language="en",
                lyrics="[Chorus]\nWe chase the dream tonight")


def test_schema_bounds_short_lyrics_but_preserves_supplied_text():
    schema = plan_schema(instrumental=False, lyrics="", language="en", duration_sec=30)
    assert schema["properties"]["lyrics"]["maxLength"] == 360
    assert plan_schema(instrumental=False, lyrics="my lyrics", language="en")["properties"]["lyrics"]["const"] == "my lyrics"
    assert plan_schema(instrumental=True, lyrics="", language="unknown")["properties"]["lyrics"]["const"] == "[Instrumental]"


@pytest.mark.parametrize("field,value", [("lyrics", "word " * 61), ("lyrics", "你好"), ("vocal_language", "zh"), ("bpm", True), ("arrangement", ["Only section"])])
def test_rejects_invalid_plan(field, value):
    plan = proposal()
    plan[field] = value
    assert validate_plan(plan, duration_sec=30, instrumental=False, lyrics="", language="en")


def test_accepts_short_plan_and_preserves_original_lyrics():
    plan = proposal()
    assert not validate_plan(plan, duration_sec=30, instrumental=False, lyrics="", language="en")
    assert validate_plan(plan, duration_sec=30, instrumental=False, lyrics="original", language="en")


@pytest.mark.parametrize("start,stop", [(11, 30), (10, 60), (10, 29), (10, 10)])
def test_arrangement_must_cover_exact_duration(start, stop):
    plan = proposal()
    plan["arrangement"][1].update(start_sec=start, end_sec=stop)
    assert validate_plan(plan, duration_sec=30, instrumental=False, lyrics="", language="en")


def test_stream_collects_content_and_checks_cancellation():
    class Response:
        def __enter__(self): return self
        def __exit__(self, *args): pass
        def raise_for_status(self): pass
        def iter_lines(self):
            yield 'data: ' + json.dumps({"choices": [{"delta": {"content": json.dumps(proposal())}}]})
            yield 'data: [DONE]'
    class Client:
        def stream(self, *args, **kwargs): return Response()
    calls = []
    assert _stream_json(Client(), "http://127.0.0.1:123", {}, {}, lambda: calls.append(1)) == proposal()
    assert len(calls) == 2
    def cancel(): raise RuntimeError("cancelled")
    with pytest.raises(RuntimeError, match="cancelled"):
        _stream_json(Client(), "http://127.0.0.1:123", {}, {}, cancel)


@pytest.mark.parametrize("failure", [False, True])
def test_owned_runtime_released_on_success_and_failure(monkeypatch, tmp_path, failure):
    from ai_sidecar import instruction_composer as module
    monkeypatch.setattr(module, "instruction_composer_available", lambda: True)
    monkeypatch.setattr(module, "composer_home", lambda: tmp_path)
    monkeypatch.setattr(module, "verify_model", lambda _: None)
    events = []
    class Process:
        def __init__(self, command, **kwargs):
            assert command[command.index("--host") + 1] == "127.0.0.1"
            assert kwargs["env"]["LLAMA_API_KEY"]
            self.done = False
        def poll(self): return 0 if self.done else None
        def terminate(self): events.append("terminate"); self.done = True
        def wait(self, **kwargs): events.append("wait")
    class Client:
        def __init__(self, **kwargs): pass
        def __enter__(self): return self
        def __exit__(self, *args): pass
        def get(self, *args, **kwargs):
            class Response: status_code = 200
            return Response()
    def infer(*args):
        if failure: raise RuntimeError("inference failure")
        return proposal()
    monkeypatch.setattr(module.subprocess, "Popen", Process)
    monkeypatch.setattr("httpx.Client", Client)
    monkeypatch.setattr(module, "_stream_json", infer)
    if failure:
        with pytest.raises(RuntimeError, match="inference failure"):
            module.plan_with_instructions("Idea", duration_sec=30, instrumental=False, lyrics="", language="en")
    else:
        plan = module.plan_with_instructions("Idea", duration_sec=30, instrumental=False, lyrics="", language="en")
        assert plan["arrangement"] == ["0–10s: verse", "10–30s: chorus and ending"]
    assert events == ["terminate", "wait"]
