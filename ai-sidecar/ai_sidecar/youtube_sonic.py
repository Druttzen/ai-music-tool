"""Download YouTube audio (yt-dlp) and extract sonic signature."""

from __future__ import annotations

import os
import tempfile
from typing import Any

from .sonic_signature import extract_sonic_signature
from .youtube_resolve import parse_video_id


def _download_audio_bytes(watch_url: str, max_sec: float = 120.0) -> bytes:
    try:
        import yt_dlp  # noqa: PLC0415
    except Exception as exc:
        raise RuntimeError("yt-dlp not installed — pip install yt-dlp in sidecar venv") from exc

    with tempfile.TemporaryDirectory() as tmp:
        outtmpl = os.path.join(tmp, "%(id)s.%(ext)s")
        opts = {
            "quiet": True,
            "no_warnings": True,
            "format": "bestaudio[ext=m4a]/bestaudio/best",
            "outtmpl": outtmpl,
            "nocheckcertificate": True,
        }
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(watch_url, download=True)
            if not isinstance(info, dict):
                raise RuntimeError("yt-dlp returned no info")
            path = ydl.prepare_filename(info)
            if not os.path.isfile(path):
                base, _ext = os.path.splitext(path)
                for ext in (".m4a", ".webm", ".opus", ".mp3", ".wav"):
                    candidate = base + ext
                    if os.path.isfile(candidate):
                        path = candidate
                        break
            if not os.path.isfile(path):
                raise RuntimeError("yt-dlp download failed")

        import librosa  # noqa: PLC0415
        import soundfile as sf  # noqa: PLC0415
        import numpy as np  # noqa: PLC0415

        y, sr = librosa.load(path, sr=22050, mono=True, duration=max_sec)
        buf = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
        try:
            sf.write(buf.name, y, sr)
            with open(buf.name, "rb") as f:
                return f.read()
        finally:
            try:
                os.unlink(buf.name)
            except OSError:
                pass


def resolve_youtube_audio_sonic(url: str) -> dict[str, Any]:
    video_id = parse_video_id(url)
    if not video_id:
        raise ValueError("Invalid YouTube URL")
    watch_url = f"https://www.youtube.com/watch?v={video_id}"
    audio_bytes = _download_audio_bytes(watch_url)
    sig = extract_sonic_signature(audio_bytes)
    sig["video_id"] = video_id
    sig["watch_url"] = watch_url
    sig["provider"] = "librosa+ytdlp"
    return sig
