#!/usr/bin/env python3
"""MCP server exposing AI Music Creator sidecar analysis tools."""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

SIDECAR = "http://127.0.0.1:8723"
_SIDECAR_TOKEN = os.environ.get("AIMC_SIDECAR_TOKEN", "").strip()
_AUTH_HEADER = "x-aimc-sidecar-token"


def _sidecar_headers(extra: dict | None = None) -> dict:
    headers = dict(extra or {})
    if _SIDECAR_TOKEN:
        headers[_AUTH_HEADER] = _SIDECAR_TOKEN
    return headers


def _post_json(path: str, payload: dict) -> dict:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{SIDECAR}{path}",
        data=data,
        headers=_sidecar_headers({"Content-Type": "application/json"}),
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:  # noqa: S310
        return json.loads(resp.read().decode("utf-8"))


def _get(path: str) -> dict:
    with urllib.request.urlopen(f"{SIDECAR}{path}", timeout=30) as resp:  # noqa: S310
        return json.loads(resp.read().decode("utf-8"))


def handle_request(req: dict) -> dict:
    method = req.get("method")
    if method == "initialize":
        return {
            "jsonrpc": "2.0",
            "id": req.get("id"),
            "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": {"tools": {}},
                "serverInfo": {"name": "ai-music-sidecar", "version": "0.44.0"},
            },
        }

    if method == "tools/list":
        return {
            "jsonrpc": "2.0",
            "id": req.get("id"),
            "result": {
                "tools": [
                    {
                        "name": "sidecar_health",
                        "description": "Check AI Music Creator sidecar health",
                        "inputSchema": {"type": "object", "properties": {}},
                    },
                    {
                        "name": "youtube_resolve",
                        "description": "Resolve YouTube URL to metadata",
                        "inputSchema": {
                            "type": "object",
                            "properties": {"url": {"type": "string"}},
                            "required": ["url"],
                        },
                    },
                    {
                        "name": "acousticbrainz_lookup",
                        "description": "Fetch AcousticBrainz features by MusicBrainz recording MBID",
                        "inputSchema": {
                            "type": "object",
                            "properties": {"recording_mbid": {"type": "string"}},
                            "required": ["recording_mbid"],
                        },
                    },
                ],
            },
        }

    if method == "tools/call":
        params = req.get("params") or {}
        name = params.get("name")
        args = params.get("arguments") or {}
        try:
            if name == "sidecar_health":
                text = json.dumps(_get("/health"))
            elif name == "youtube_resolve":
                text = json.dumps(_post_json("/youtube/resolve", {"url": args.get("url", "")}))
            elif name == "acousticbrainz_lookup":
                mbid = args.get("recording_mbid", "")
                text = json.dumps(_get(f"/acousticbrainz/{mbid}"))
            else:
                raise ValueError(f"unknown tool: {name}")
        except (urllib.error.URLError, ValueError) as exc:
            return {
                "jsonrpc": "2.0",
                "id": req.get("id"),
                "result": {"content": [{"type": "text", "text": f"error: {exc}"}], "isError": True},
            }
        return {
            "jsonrpc": "2.0",
            "id": req.get("id"),
            "result": {"content": [{"type": "text", "text": text}]},
        }

    return {"jsonrpc": "2.0", "id": req.get("id"), "result": {}}


def main() -> None:
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except json.JSONDecodeError:
            continue
        resp = handle_request(req)
        sys.stdout.write(json.dumps(resp) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
