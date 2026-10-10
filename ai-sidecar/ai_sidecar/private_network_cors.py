"""CORS + Private Network Access for the Tauri webview → localhost sidecar.

Chromium treats `https://tauri.localhost` → `http://127.0.0.1` as public→private.
Preflight responses must include Access-Control-Allow-Private-Network.
"""

from __future__ import annotations

from urllib.parse import urlparse

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

_ALLOWED_HOSTS = {"localhost", "127.0.0.1", "tauri.localhost"}
_ALLOWED_SCHEMES = {"http", "https", "tauri"}
_ALLOW_HEADERS = "x-aimc-sidecar-token, Content-Type, Accept, Authorization"
EXPOSE_HEADERS = (
    "Content-Disposition", "X-Job-Id", "X-Vocal-Embed-Engine",
    "X-Vocal-Transform-Mode", "X-Vocal-Transform-Has-Remix",
    "X-Vocal-Transform-Has-Vocals", "X-Vocal-Transform-Vocals-Url",
    "X-Cover-Model", "X-Cover-Mode", "X-Cover-Width", "X-Cover-Height",
    "X-Cover-Strength", "X-MusicGen-Model", "X-MusicGen-Duration-Sec",
    "X-MusicGen-Mode", "X-AceStep-Model", "X-AceStep-Duration-Sec", "X-AceStep-Mode",
)


def origin_allowed(origin: str) -> bool:
    if not origin:
        return False
    parsed = urlparse(origin)
    if parsed.scheme not in _ALLOWED_SCHEMES:
        return False
    host = (parsed.hostname or "").lower()
    return host in _ALLOWED_HOSTS


def apply_private_network_headers(response: Response, origin: str) -> Response:
    if origin_allowed(origin):
        response.headers["Access-Control-Allow-Private-Network"] = "true"
        response.headers.setdefault("Access-Control-Allow-Origin", origin)
        response.headers["Access-Control-Expose-Headers"] = ", ".join(EXPOSE_HEADERS)
        response.headers.setdefault("Vary", "Origin")
    return response


class PrivateNetworkCorsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        origin = request.headers.get("origin", "")
        # Handle preflight here. Starlette BaseHTTPMiddleware can make inner
        # CORSMiddleware reject OPTIONS with 400.
        if request.method == "OPTIONS" and origin_allowed(origin):
            requested = request.headers.get("access-control-request-headers") or _ALLOW_HEADERS
            response = Response(status_code=204)
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Methods"] = (
                "GET, POST, PUT, PATCH, DELETE, OPTIONS"
            )
            response.headers["Access-Control-Allow-Headers"] = requested
            response.headers["Access-Control-Allow-Private-Network"] = "true"
            response.headers["Vary"] = "Origin"
            return response
        response = await call_next(request)
        return apply_private_network_headers(response, origin)
