"""Single-worker job queue for long sidecar operations."""

from __future__ import annotations

import os
import shutil
import tempfile
import threading
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable


@dataclass
class Job:
    job_id: str
    kind: str
    status: str = "queued"  # queued | running | done | error | cancelled
    progress: float = 0.0
    message: str = ""
    error: str | None = None
    result: dict[str, Any] | None = None
    payload: dict[str, Any] = field(default_factory=dict)
    created: float = field(default_factory=time.time)
    cancel: bool = field(default=False, repr=False)

    def to_status(self) -> dict[str, Any]:
        return {
            "job_id": self.job_id,
            "kind": self.kind,
            "status": self.status,
            "progress": self.progress,
            "message": self.message,
            "error": self.error,
            "result": self.result,
        }


RunnerFn = Callable[["JobContext"], dict[str, Any] | None]

_RUNNERS: dict[str, RunnerFn] = {}
_ARTIFACT_KEYS = ("out_dir", "output_dir", "path")


def _tmp_roots() -> list[Path]:
    roots: list[Path] = []
    for key in ("TMPDIR", "TEMP", "TMP"):
        raw = os.environ.get(key)
        if raw:
            roots.append(Path(raw))
    roots.append(Path(tempfile.gettempdir()))
    resolved: list[Path] = []
    for root in roots:
        try:
            resolved.append(root.resolve())
        except OSError:
            continue
    return resolved


def _is_under_tmp(path: Path) -> bool:
    try:
        resolved = path.resolve()
    except OSError:
        return False
    for root in _tmp_roots():
        if resolved == root:
            continue
        try:
            resolved.relative_to(root)
            return True
        except ValueError:
            continue
    return False


def _iter_artifact_paths(result: dict[str, Any]) -> list[Path]:
    found: list[Path] = []
    for key in _ARTIFACT_KEYS:
        raw = result.get(key)
        if isinstance(raw, str) and raw.strip():
            found.append(Path(raw))
    extra = result.get("paths")
    if isinstance(extra, dict):
        for raw in extra.values():
            if isinstance(raw, str) and raw.strip():
                found.append(Path(raw))
    return found


def cleanup_job_artifacts(result: dict[str, Any] | None) -> None:
    """Delete job outputs that live under the process temp root."""
    if not result:
        return
    for path in _iter_artifact_paths(result):
        if not _is_under_tmp(path):
            continue
        if path.is_dir():
            shutil.rmtree(path, ignore_errors=True)
        elif path.is_file():
            try:
                path.unlink()
            except OSError:
                pass


def register(kind: str):
    def deco(fn: RunnerFn):
        _RUNNERS[kind] = fn
        return fn

    return deco


@dataclass
class JobContext:
    job: Job

    def set_progress(self, progress: float, message: str = "") -> None:
        self.job.progress = max(0.0, min(1.0, float(progress)))
        if message:
            self.job.message = message

    @property
    def payload(self) -> dict[str, Any]:
        return self.job.payload

    @property
    def cancelled(self) -> bool:
        return bool(self.job.cancel)


class JobManager:
    def __init__(self) -> None:
        self._jobs: dict[str, Job] = {}
        self._lock = threading.Lock()
        # Serialize long GPU/CPU jobs across FastAPI threadpool workers.
        self._worker_lock = threading.Lock()
        self._ttl_sec = 3600.0

    def prune(self) -> None:
        now = time.time()
        expired: list[Job] = []
        with self._lock:
            stale_ids = [jid for jid, job in self._jobs.items() if now - job.created > self._ttl_sec]
            for jid in stale_ids:
                job = self._jobs.pop(jid, None)
                if job is not None:
                    expired.append(job)
        for job in expired:
            cleanup_job_artifacts(job.result)

    def get(self, job_id: str) -> Job | None:
        self.prune()
        with self._lock:
            return self._jobs.get(job_id)

    def run_inline(self, kind: str, payload: dict[str, Any] | None = None, *, label: str = "") -> Job:
        """Run a registered kind on the calling thread, one job at a time."""
        runner = _RUNNERS.get(kind)
        if not runner:
            raise KeyError(f"unknown job kind: {kind}")

        job = Job(
            job_id=uuid.uuid4().hex[:16],
            kind=kind,
            status="queued",
            message=label or kind,
            payload=dict(payload or {}),
        )
        with self._lock:
            self._jobs[job.job_id] = job

        with self._worker_lock:
            job.status = "running"
            ctx = JobContext(job)
            try:
                result = runner(ctx)
                if job.cancel:
                    job.status = "cancelled"
                else:
                    job.status = "done"
                    job.progress = 1.0
                    job.result = result or {}
                    job.message = job.message or "done"
            except Exception as exc:
                job.status = "error"
                job.error = str(exc)
                job.message = str(exc)
                raise
        return job


JOBS = JobManager()
