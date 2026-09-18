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


def test_cleanup_ignores_empty_result():
    cleanup_job_artifacts(None)
    cleanup_job_artifacts({})
    assert Path(".").exists()
