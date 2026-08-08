"""Single-worker job queue for long sidecar operations."""

from __future__ import annotations

import threading
import time
import uuid
from dataclasses import dataclass, field
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
        self._ttl_sec = 3600.0

    def prune(self) -> None:
        now = time.time()
        with self._lock:
            expired = [jid for jid, job in self._jobs.items() if now - job.created > self._ttl_sec]
            for jid in expired:
                self._jobs.pop(jid, None)

    def get(self, job_id: str) -> Job | None:
        self.prune()
        with self._lock:
            return self._jobs.get(job_id)

    def run_inline(self, kind: str, payload: dict[str, Any] | None = None, *, label: str = "") -> Job:
        """Run a registered kind synchronously on the calling thread."""
        runner = _RUNNERS.get(kind)
        if not runner:
            raise KeyError(f"unknown job kind: {kind}")

        job = Job(
            job_id=uuid.uuid4().hex[:16],
            kind=kind,
            message=label or kind,
            payload=dict(payload or {}),
        )
        with self._lock:
            self._jobs[job.job_id] = job

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
