"""In-app Fail-Safe Runtime delivery (maintainer mode only)."""

from __future__ import annotations

import json
import os
import subprocess
import tempfile
from typing import Any, Literal

from pydantic import BaseModel, Field


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


class RuntimeDeliverRequest(BaseModel):
    payload: dict[str, Any] = Field(default_factory=dict)
    mode: Literal["issue", "branch", "pr"] = "issue"
    github_token: str | None = None


class RuntimeDeliverResponse(BaseModel):
    ok: bool
    stage: str
    message: str
    issue_url: str | None = None
    issue_number: int | None = None
    branch: str | None = None
    commit: str | None = None
    pr_url: str | None = None


def deliver_runtime_report(body: RuntimeDeliverRequest) -> RuntimeDeliverResponse:
    if not maintainer_enabled():
        return RuntimeDeliverResponse(
            ok=False,
            stage="auth",
            message="Maintainer mode off — start sidecar with npm run sidecar:maintainer",
        )

    root = repo_root()
    if body.mode in ("branch", "pr") and not root:
        return RuntimeDeliverResponse(
            ok=False,
            stage="config",
            message="AIMC_REPO_ROOT not set — required for branch/PR delivery",
        )

    node = os.environ.get("AIMC_NODE", "node")
    script = os.path.join(root or os.getcwd(), "scripts", "fail-safe-runtime-deliver.cjs")
    if not os.path.isfile(script):
        return RuntimeDeliverResponse(ok=False, stage="config", message=f"Missing script: {script}")

    with tempfile.NamedTemporaryFile(
        mode="w",
        suffix=".json",
        delete=False,
        encoding="utf-8",
    ) as tmp:
        json.dump(body.payload, tmp)
        tmp_path = tmp.name

    args = [node, script, tmp_path, "--json"]
    if body.mode == "branch":
        args.append("--branch")
    elif body.mode == "pr":
        args.append("--pr")

    env = {**os.environ}
    token = (body.github_token or os.environ.get("GITHUB_TOKEN") or "").strip()
    if token:
        env["AIMC_GITHUB_TOKEN"] = token

    try:
        proc = subprocess.run(
            args,
            cwd=root or os.getcwd(),
            capture_output=True,
            text=True,
            timeout=300,
            env=env,
            check=False,
        )
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass

    raw = (proc.stdout or proc.stderr or "").strip().splitlines()
    line = raw[-1] if raw else "{}"
    try:
        data: dict[str, Any] = json.loads(line)
    except json.JSONDecodeError:
        return RuntimeDeliverResponse(
            ok=False,
            stage="deliver",
            message=proc.stderr or proc.stdout or f"runtime-deliver exited {proc.returncode}",
        )

    return RuntimeDeliverResponse(
        ok=bool(data.get("ok")),
        stage=str(data.get("stage") or "done"),
        message=str(data.get("message") or ""),
        issue_url=data.get("issueUrl"),
        issue_number=data.get("issueNumber"),
        branch=data.get("branch"),
        commit=data.get("commit"),
        pr_url=data.get("prUrl"),
    )
