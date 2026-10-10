import asyncio
import json
import sys
import threading
import time
from types import ModuleType, SimpleNamespace

import pytest

from ai_sidecar.jobs import Job, JobManager, register
from ai_sidecar.model_readiness import addon_enabled, hf_model_cached, readiness
from ai_sidecar.model_resources import model_operation, require_free_vram
from ai_sidecar.vocal_ml_models import _diffsinger_argv, rvc_model_configured


def test_active_jobs_survive_ttl_and_finished_jobs_expire():
    manager = JobManager()
    manager._ttl_sec = 1
    running = Job("active", "test", status="running", created=0)
    queued = Job("queued", "test", created=0)
    fresh = Job("fresh", "test", status="done", created=0, finished=time.time())
    expired = Job("expired", "test", status="done", created=0, finished=1)
    manager._jobs = {job.job_id: job for job in [running, queued, fresh, expired]}
    manager.prune()
    assert set(manager._jobs) == {"active", "queued", "fresh"}


@pytest.mark.parametrize("fails", [False, True])
def test_terminal_jobs_release_uploads(fails):
    @register("regression.release")
    def runner(ctx):
        assert ctx.payload["raw"] == b"audio"
        if fails:
            raise RuntimeError("failed")
        return {"meta": {"ok": True}}
    manager = JobManager()
    if fails:
        with pytest.raises(RuntimeError):
            manager.run_inline("regression.release", {"raw": b"audio"})
        job = next(iter(manager._jobs.values()))
    else:
        job = manager.run_inline("regression.release", {"raw": b"audio"})
    assert job.payload == {}
    assert job.finished is not None


def test_queue_rejects_excess_bytes_and_queued_cancel_releases_them():
    @register("regression.queue")
    def runner(ctx):
        return {}
    manager = JobManager()
    manager._max_payload_bytes = 4
    _, job = manager._new_job("regression.queue", {"raw": b"1234"}, "test")
    with pytest.raises(RuntimeError, match="queue is full"):
        manager._new_job("regression.queue", {"raw": b"5"}, "test")
    manager.cancel(job.job_id)
    assert job.payload == {}
    assert job.finished
    manager._new_job("regression.queue", {"raw": b"1234"}, "test")


def test_disabled_addon_preserves_independent_sibling(tmp_path, monkeypatch):
    path = tmp_path / "disabled.json"
    path.write_text(json.dumps(["cover", "classify"]))
    monkeypatch.setenv("AIMC_DISABLED_EXTRAS_FILE", str(path))
    assert not addon_enabled("cover")
    assert not addon_enabled("genre")
    assert addon_enabled("cover-ref")
    assert addon_enabled("vocal_ml")


def test_missing_hf_shard_is_not_offline_ready(tmp_path):
    (tmp_path / "config.json").write_text("{}")
    (tmp_path / "model.safetensors.index.json").write_text(json.dumps({"weight_map": {"a": "one.safetensors", "b": "two.safetensors"}}))
    (tmp_path / "one.safetensors").write_bytes(b"weights")
    assert not hf_model_cached(str(tmp_path))
    (tmp_path / "two.safetensors").write_bytes(b"weights")
    assert hf_model_cached(str(tmp_path))


def test_clean_only_melband_cache_does_not_offer_standard_model(tmp_path, monkeypatch):
    import importlib.machinery
    import os
    from pathlib import Path
    from ai_sidecar.model_readiness import melband_models_cached
    package = tmp_path / "package"
    (package / "data").mkdir(parents=True)
    (package / "data/melband_models.json").write_text(json.dumps({"models": {
        "melband-roformer-kimmel-ft2-bleedless": {"checkpoint": "clean.ckpt", "config": "clean.yaml"},
        "melband-roformer-kim-vocals": {"checkpoint": "standard.ckpt", "config": "standard.yaml"},
    }}))
    fake = ModuleType("mel_band_roformer")
    fake.__spec__ = importlib.machinery.ModuleSpec(fake.__name__, None, origin=str(package / "__init__.py"))
    monkeypatch.setitem(sys.modules, fake.__name__, fake)
    cache = tmp_path / "models"
    clean = cache / "melband-roformer-kimmel-ft2-bleedless"
    clean.mkdir(parents=True)
    (clean / "clean.ckpt").write_bytes(b"weight placeholder")
    (clean / "clean.yaml").write_text("config")
    monkeypatch.setenv("MELBAND_ROFORMER_MODELS_PATH", str(cache))
    original_stat = Path.stat
    def stat(path, *args, **kwargs):
        original = original_stat(path, *args, **kwargs)
        if path == clean / "clean.ckpt":
            fields = list(original)
            fields[6] = 913101368
            return os.stat_result(fields)
        return original
    monkeypatch.setattr(Path, "stat", stat)
    assert melband_models_cached() == {"melband-clean": True, "melband": False}


def test_rvc_packages_without_model_are_not_ready(tmp_path, monkeypatch):
    monkeypatch.delenv("AIMC_RVC_API_URL", raising=False)
    monkeypatch.delenv("AIMC_RVC_MODELS_DIR", raising=False)
    monkeypatch.setenv("AIMC_RVC_MODEL", str(tmp_path / "missing.pth"))
    monkeypatch.setattr("ai_sidecar.vocal_ml_models.rvc_python_available", lambda: True)
    assert not rvc_model_configured()
    assert not readiness("rvc")["runtimeReady"]
    assert not readiness("rvc")["offlineReady"]


def test_diffsinger_json_argv_preserves_windows_paths(monkeypatch):
    argv = [r"C:\Program Files\Python\python.exe", r"F:\Voice Models\infer.py", "--voice", "Simon B"]
    monkeypatch.setenv("AIMC_DIFFSINGER_ARGV", json.dumps(argv))
    assert _diffsinger_argv() == argv
    monkeypatch.setenv("AIMC_DIFFSINGER_ARGV", '{"bad": true}')
    with pytest.raises(ValueError):
        _diffsinger_argv()


def test_diffsinger_legacy_quoted_paths(monkeypatch):
    monkeypatch.delenv("AIMC_DIFFSINGER_ARGV", raising=False)
    monkeypatch.setenv("AIMC_DIFFSINGER_CMD", '"C:/Program Files/Python/python.exe" "F:/Voice Models/infer.py" --voice "Simon B"')
    assert _diffsinger_argv() == ["C:/Program Files/Python/python.exe", "F:/Voice Models/infer.py", "--voice", "Simon B"]


def test_direct_models_share_lock_and_release_cache(monkeypatch):
    fake = ModuleType("ai_sidecar.musicgen")
    fake._MODEL = object()
    monkeypatch.setitem(sys.modules, "ai_sidecar.musicgen", fake)
    entered = threading.Event()
    release = threading.Event()
    second = threading.Event()
    @model_operation()
    def first():
        entered.set()
        release.wait(2)
    @model_operation()
    def next_model():
        second.set()
    a = threading.Thread(target=first)
    b = threading.Thread(target=next_model)
    a.start()
    assert entered.wait(1)
    b.start()
    assert not second.wait(.05)
    release.set()
    a.join(2)
    b.join(2)
    assert second.is_set()
    assert fake._MODEL is None


def test_gpu_admission_rejects_external_memory_without_killing_process(monkeypatch):
    fake = SimpleNamespace(cuda=SimpleNamespace(is_available=lambda: True, mem_get_info=lambda: (128 * 1024 ** 2, 12 * 1024 ** 3)))
    monkeypatch.setitem(sys.modules, "torch", fake)
    with pytest.raises(RuntimeError, match="Pause another local engine"):
        require_free_vram("cuda", 2)


def test_cover_inference_does_not_block_event_loop(monkeypatch):
    from ai_sidecar import main
    def cover(*args, **kwargs):
        time.sleep(.12)
        return b"png", {}
    monkeypatch.setattr(main, "cover_available", lambda: True)
    monkeypatch.setattr(main, "generate_cover_png", cover)
    monkeypatch.setattr(main, "select_device", lambda: "cpu")
    async def run():
        task = asyncio.create_task(main.generate_cover(main.CoverRequest(prompt="test")))
        await asyncio.sleep(.03)
        assert not task.done(), "inference blocked the event loop"
        assert (await task).body == b"png"
    asyncio.run(run())


def test_cors_exposes_vocal_urls_and_generation_metadata():
    from fastapi.testclient import TestClient
    from ai_sidecar.main import app
    for origin in ("http://localhost:3000", "https://tauri.localhost", "tauri://localhost"):
        response = TestClient(app).get("/health", headers={"Origin": origin})
        exposed = response.headers["access-control-expose-headers"].lower()
        assert "x-vocal-transform-vocals-url" in exposed
        assert "x-vocal-transform-has-remix" in exposed
        assert "x-musicgen-model" in exposed
