"""Resolve YouTube watch URLs to public metadata (server-side — avoids browser CORS)."""

from __future__ import annotations

import json
import re
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

_USER_AGENT = "AI-Music-Creator/0.41.1 (youtube-resolve; local-sidecar)"

_VIDEO_ID_PATTERNS = (
    re.compile(
        r"(?:youtube\.com/watch\?[^#]*v=|youtube\.com/watch\?v=|youtu\.be/|youtube\.com/shorts/|youtube\.com/live/)([\w-]{11})",
        re.I,
    ),
    re.compile(r"[?&]v=([\w-]{11})", re.I),
)

_OFFICIAL_SUFFIX = re.compile(
    r"\s*[\(\[]?(official\s*(music\s*)?video|audio|lyric|mv|hd|4k|remaster(?:ed)?|visualizer|live|topic).*?$",
    re.I,
)


def parse_video_id(url: str) -> str | None:
    raw = str(url or "").strip()
    if not raw:
        return None
    for pattern in _VIDEO_ID_PATTERNS:
        match = pattern.search(raw)
        if match:
            return match.group(1)
    return None


def parse_music_title(title: str) -> dict[str, str]:
    cleaned = _OFFICIAL_SUFFIX.sub("", str(title or "").strip()).strip()
    if not cleaned:
        return {"artist": "", "track": "", "search_query": ""}

    for sep in (" - ", " – ", " — ", " | ", ": "):
        if sep in cleaned:
            left, right = cleaned.split(sep, 1)
            artist = left.strip()
            track = right.strip()
            if artist and track:
                return {
                    "artist": artist,
                    "track": track,
                    "search_query": f"{artist} {track}".strip(),
                }

    return {"artist": "", "track": cleaned, "search_query": cleaned}


def _fetch_oembed(watch_url: str) -> dict[str, Any] | None:
    endpoint = (
        "https://www.youtube.com/oembed?"
        + urllib.parse.urlencode({"url": watch_url, "format": "json"})
    )
    req = urllib.request.Request(endpoint, headers={"User-Agent": _USER_AGENT, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, ValueError):
        return None


def _fetch_yt_dlp_info(watch_url: str) -> dict[str, Any] | None:
    try:
        import yt_dlp  # noqa: PLC0415
    except Exception:
        return None

    opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "nocheckcertificate": True,
    }
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(watch_url, download=False)
        return info if isinstance(info, dict) else None
    except Exception:
        return None


def resolve_youtube_url(url: str) -> dict[str, Any]:
    video_id = parse_video_id(url)
    if not video_id:
        raise ValueError("Invalid YouTube URL")

    watch_url = f"https://www.youtube.com/watch?v={video_id}"
    oembed = _fetch_oembed(watch_url) or {}
    ytdlp = _fetch_yt_dlp_info(watch_url) or {}

    title = str(ytdlp.get("title") or oembed.get("title") or video_id).strip()
    author = str(
        ytdlp.get("artist")
        or ytdlp.get("uploader")
        or oembed.get("author_name")
        or "",
    ).strip()
    duration_sec = ytdlp.get("duration")
    if not isinstance(duration_sec, (int, float)):
        duration_sec = None

    parsed = parse_music_title(title)
    if not parsed["artist"] and author and author.lower() not in {"vevo", "topic"}:
        parsed = {
            "artist": author,
            "track": parsed["track"] or title,
            "search_query": f"{author} {parsed['track'] or title}".strip(),
        }

    tags = ytdlp.get("tags") if isinstance(ytdlp.get("tags"), list) else []
    categories = ytdlp.get("categories") if isinstance(ytdlp.get("categories"), list) else []
    description = str(ytdlp.get("description") or "")[:1200]

    return {
        "video_id": video_id,
        "watch_url": watch_url,
        "title": title,
        "author_name": author,
        "thumbnail_url": str(oembed.get("thumbnail_url") or ytdlp.get("thumbnail") or ""),
        "duration_sec": duration_sec,
        "parsed_artist": parsed["artist"],
        "parsed_track": parsed["track"],
        "search_query": parsed["search_query"] or title,
        "tags": [str(t) for t in tags[:12] if t],
        "categories": [str(c) for c in categories[:6] if c],
        "description_excerpt": description,
        "provider": "yt-dlp" if ytdlp else ("oembed" if oembed else "fallback"),
    }
