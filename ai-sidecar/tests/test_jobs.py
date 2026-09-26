"""Job queue prune must delete temp artifacts, not just drop the in-memory job."""

from pathlib import Path

from ai_sidecar.jobs import Job, JobManager, cleanup_job_artifacts, _is_under_tmp


def test_cleanup_job_artifacts_removes_tmp_dir(tmp_path, monkeypatch):
    monkeypatch.setattr("ai_sidecar.jobs._tmp_roots", lambda: [tmp_path.resolve()])
    out = tmp_path / "job-out"
    out.mkdir()
    (out / "stem.wav").write_bytes(b"wav")
    cleanup_job_artifacts({"out_dir": str(out), "paths": {"vocals.wav": str(out / "stem.wav")}})
    assert not out.exists()


def test_cleanup_job_artifacts_skips_outside_tmp(tmp_path, monkeypatch):
    allowed = tmp_path / "tmp-root"
    allowed.mkdir()
    outside = tmp_path / "outside"
    outside.mkdir()
    marker = outside / "keep.txt"
    marker.write_text("keep", encoding="utf-8")
    monkeypatch.setattr("ai_sidecar.jobs._tmp_roots", lambda: [allowed.resolve()])
    cleanup_job_artifacts({"out_dir": str(outside)})
    assert marker.is_file()


def test_is_under_tmp_rejects_tmp_root(tmp_path, monkeypatch):
    monkeypatch.setattr("ai_sidecar.jobs._tmp_roots", lambda: [tmp_path.resolve()])
    assert _is_under_tmp(tmp_path) is False
    assert _is_under_tmp(tmp_path / "child") is True


def test_prune_deletes_expired_tmp_artifacts(tmp_path, monkeypatch):
    monkeypatch.setattr("ai_sidecar.jobs._tmp_roots", lambda: [tmp_path.resolve()])
    out = tmp_path / "expired-job"
    out.mkdir()
    (out / "x.wav").write_bytes(b"x")
    mgr = JobManager()
    mgr._ttl_sec = 0.0
    job = Job(job_id="expired1", kind="stems", result={"out_dir": str(out)})
    job.created = 0.0
    with mgr._lock:
        mgr._jobs[job.job_id] = job
    mgr.prune()
    assert not out.exists()
    with mgr._lock:
        assert "expired1" not in mgr._jobs


def test_cleanup_job_artifacts_removes_tmp_file(tmp_path, monkeypatch):
    monkeypatch.setattr("ai_sidecar.jobs._tmp_roots", lambda: [tmp_path.resolve()])
    wav = tmp_path / "gen.wav"
    wav.write_bytes(b"RIFF")
    cleanup_job_artifacts({"path": str(wav)})
    assert not wav.exists()


def test_start_reports_public_status_without_paths():
    import time

    from ai_sidecar.jobs import JobManager, public_job_status, register

    @register("test.public-status")
    def _runner(ctx):
        ctx.set_progress(0.4, "working")
        return {"path": "C:/secret.wav", "meta": {"model": "tiny", "duration_sec": 2, "mode": "text"}}

    mgr = JobManager()
    job = mgr.start("test.public-status", {"prompt": "x"}, label="t")
    for _ in range(50):
        if job.status in {"done", "error"}:
            break
        time.sleep(0.02)
    body = public_job_status(job)
    assert body["status"] == "done"
    assert body["result"]["model"] == "tiny"
    assert "path" not in body["result"]
    assert "C:/secret" not in str(body)


def test_cleanup_ignores_empty_result():
    cleanup_job_artifacts(None)
    cleanup_job_artifacts({})
    assert Path(".").exists()


def test_cancel_queued_job_prevents_runner_execution():
    import threading

    from ai_sidecar.jobs import JobManager, register

    ran = []
    @register("test.cancel-queued")
    def _runner(ctx):
        ran.append(True)
        return {"path": "should-not-exist"}

    mgr = JobManager()
    mgr._worker_lock.acquire()
    try:
        job = mgr.start("test.cancel-queued")
        cancelled = mgr.cancel(job.job_id)
        assert cancelled is job
        assert job.status == "cancelled"
        assert job.cancel is True
    finally:
        mgr._worker_lock.release()

    import time
    time.sleep(0.03)
    assert ran == []


def test_cancel_running_non_cancellable_job_completes():
    import threading
    import time

    from ai_sidecar.jobs import JobManager, register

    started = threading.Event()
    release = threading.Event()

    @register("test.cancel-running")
    def _runner(ctx):
        started.set()
        release.wait(timeout=2)
        return {"path": "C:/completed.wav"}

    mgr = JobManager()
    job = mgr.start("test.cancel-running")
    assert started.wait(timeout=1)
    requested = mgr.cancel(job.job_id)
    assert requested is job
    assert job.status == "cancellation_requested"
    release.set()

    for _ in range(50):
        if job.status in {"done", "error"}:
            break
        time.sleep(0.02)
    assert job.status == "done"
    assert job.result == {"path": "C:/completed.wav"}


def test_cancel_running_cooperative_job_becomes_cancelled():
    import threading
    import time

    from ai_sidecar.jobs import JobManager, register

    started = threading.Event()
    release = threading.Event()

    @register("test.cancel-cooperative")
    def _runner(ctx):
        started.set()
        release.wait(timeout=2)
        if ctx.cancelled:
            ctx.acknowledge_cancellation()
            return {"path": "C:/discarded.wav"}
        return {"path": "C:/completed.wav"}

    mgr = JobManager()
    job = mgr.start("test.cancel-cooperative")
    assert started.wait(timeout=1)
    mgr.cancel(job.job_id)
    assert job.status == "cancellation_requested"
    release.set()

    for _ in range(50):
        if job.status in {"cancelled", "error", "done"}:
            break
        time.sleep(0.02)
    assert job.status == "cancelled"


def test_cancel_completed_or_failed_job_is_idempotent():
    from ai_sidecar.jobs import JobManager, register

    @register("test.cancel-done")
    def _done(ctx):
        return {"path": "C:/done.wav"}

    @register("test.cancel-error")
    def _error(ctx):
        raise RuntimeError("boom")

    mgr = JobManager()
    done = mgr.run_inline("test.cancel-done")
    assert mgr.cancel(done.job_id) is done
    assert done.status == "done"

    try:
        mgr.run_inline("test.cancel-error")
    except RuntimeError:
        pass
    failed = next(job for job in mgr._jobs.values() if job.kind == "test.cancel-error")
    assert mgr.cancel(failed.job_id) is failed
    assert failed.status == "error"


def test_cancel_does_not_delete_existing_artifact():
    import threading
    import time

    from ai_sidecar.jobs import JobManager, register

    finished = threading.Event()
    @register("test.cancel-artifact")
    def _runner(ctx):
        finished.wait(timeout=2)
        return {"path": "C:/completed.wav"}

    mgr = JobManager()
    job = mgr.start("test.cancel-artifact")
    mgr.cancel(job.job_id)
    assert job.status == "cancellation_requested"
    finished.set()

    for _ in range(50):
        if job.status in {"done", "error"}:
            break
        time.sleep(0.02)
    assert job.status == "done"
    assert job.result == {"path": "C:/completed.wav"}


def test_public_status_exposes_cancellation_requested():
    from ai_sidecar.jobs import JobManager, public_job_status, register

    started = threading.Event()
    release = threading.Event()

    @register("test.public-cancel")
    def _runner(ctx):
        started.set()
        release.wait(timeout=2)
        return {}

    mgr = JobManager()
    job = mgr.start("test.public-cancel")
    assert started.wait(timeout=1)
    mgr.cancel(job.job_id)
    body = public_job_status(job)
    assert body["status"] == "cancellation_requested"
    release.set()
