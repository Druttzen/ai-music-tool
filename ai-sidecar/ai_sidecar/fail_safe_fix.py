"""In-app fail-safe fix + git push (maintainer mode only)."""

from __future__ import annotations

import json
import os
import subprocess
from typing import Any, Literal

import httpx
from pydantic import BaseModel


def maintainer_enabled() -> bool:
    return os.environ.get("AIMC_MAINTAINER", "").strip().lower() in ("1", "true", "yes")


def repo_root() -> str:
    root = os.environ.get("AIMC_REPO_ROOT", "").strip()
    if root and os.path.isdir(root):
        return root
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    candidate = os.path.dirname(here)
    if os.path.isfile(os.path.join(candidate, "package.json")):
        return candidate
    return ""


class FixPushRequest(BaseModel):
    mode: Literal["local", "cloud"] = "local"
    github_token: str | None = None


class FixPushResponse(BaseModel):
    ok: bool
    stage: str
    message: str
    branch: str | None = None
    commit: str | None = None
    pr_url: str | None = None
    changed: bool | None = None
    workflow_url: str | None = None


def _run_local_fix_push() -> FixPushResponse:
    root = repo_root()
    if not root:
        return FixPushResponse(
            ok=False,
            stage="config",
            message="AIMC_REPO_ROOT not set — restart sidecar with npm run sidecar:maintainer",
        )

    node = os.environ.get("AIMC_NODE", "node")
    script = os.path.join(root, "scripts", "fail-safe-fix-and-push.cjs")
    if not os.path.isfile(script):
        return FixPushResponse(ok=False, stage="config", message=f"Missing script: {script}")

    env = {**os.environ, "AIMC_FIX_PUSH": "1"}
    proc = subprocess.run(
        [node, script, "--app", "--json"],
        cwd=root,
        capture_output=True,
        text=True,
        timeout=900,
        env=env,
        check=False,
    )
    raw = (proc.stdout or proc.stderr or "").strip().splitlines()
    line = raw[-1] if raw else "{}"
    try:
        data: dict[str, Any] = json.loads(line)
    except json.JSONDecodeError:
        return FixPushResponse(
            ok=False,
            stage="fail-safe",
            message=proc.stderr or proc.stdout or f"fix-push exited {proc.returncode}",
        )

    return FixPushResponse(
        ok=bool(data.get("ok")),
        stage=str(data.get("stage") or "done"),
        message=str(data.get("message") or ""),
        branch=data.get("branch"),
        commit=data.get("commit"),
        pr_url=data.get("prUrl"),
        changed=data.get("changed"),
    )


def _run_cloud_dispatch(token: str) -> FixPushResponse:
    repo = os.environ.get("GITHUB_REPOSITORY", "").strip() or os.environ.get(
        "AIMC_GITHUB_REPO", "Druttzen/ai-music-tool"
    ).strip()

    url = f"https://api.github.com/repos/{repo}/dispatches"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    body = {
        "event_type": "fail-safe-fix-push",
        "client_payload": {"source": "ai-music-tool-app"},
    }
    with httpx.Client(timeout=30.0) as client:
        res = client.post(url, headers=headers, json=body)
        if res.status_code >= 400:
            return FixPushResponse(
                ok=False,
                stage="cloud",
                message=f"GitHub dispatch failed ({res.status_code}): {res.text[:200]}",
            )

    return FixPushResponse(
        ok=True,
        stage="cloud",
        message="Cloud fix started — Actions will auto-fix, commit, push, and open a PR.",
        workflow_url=f"https://github.com/{repo}/actions/workflows/fail-safe-auto-fix.yml",
    )


def fix_push(body: FixPushRequest) -> FixPushResponse:
    if not maintainer_enabled():
        return FixPushResponse(
            ok=False,
            stage="auth",
            message="Maintainer mode off — start sidecar with npm run sidecar:maintainer",
        )

    if body.mode == "cloud":
        token = (body.github_token or os.environ.get("GITHUB_TOKEN") or "").strip()
        if not token:
            return FixPushResponse(
                ok=False,
                stage="auth",
                message="GitHub token required for cloud fix",
            )
        return _run_cloud_dispatch(token)

    return _run_local_fix_push()
