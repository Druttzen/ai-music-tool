"""Fetch archived AcousticBrainz features by MusicBrainz recording MBID."""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from typing import Any

_AB_BASE = "https://acousticbrainz.org/api/v1"
_USER_AGENT = "AI-Music-Creator/0.42.0 (acousticbrainz; local-sidecar)"


def _get_json(url: str) -> dict[str, Any] | None:
    req = urllib.request.Request(url, headers={"User-Agent": _USER_AGENT, Accept: "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:  # noqa: S310
            return json.loads(resp.read().decode("utf-8"))
    except (urllib.error.HTTPError, urllib.error.URLError, json.JSONDecodeError, TimeoutError):
        return None


def fetch_acousticbrainz_features(recording_mbid: str) -> dict[str, Any] | None:
    """Return low-level + high-level AB features when available for a recording MBID."""
    mbid = str(recording_mbid or "").strip()
    if not mbid:
        return None

    low = _get_json(f"{_AB_BASE}/{mbid}/low-level")
    high = _get_json(f"{_AB_BASE}/{mbid}/high-level")

    if not low and not high:
        return None

    out: dict[str, Any] = {"recording_mbid": mbid, "provider": "acousticbrainz"}

    if low:
        tonal = low.get("tonal", {})
        rhythm = low.get("rhythm", {})
        lowlevel = low.get("lowlevel", {})
        out["bpm"] = rhythm.get("bpm")
        out["key_key"] = tonal.get("key_key")
        out["key_scale"] = tonal.get("key_scale")
        out["key_strength"] = tonal.get("key_strength")
        out["danceability"] = low.get("rhythm", {}).get("danceability")
        out["loudness"] = lowlevel.get("average_loudness")

    if high:
        mood = high.get("highlevel", {}).get("mood_", {})
        genre = high.get("highlevel", {}).get("genre_", {})
        dance = high.get("highlevel", {}).get("danceability", {})
        voice = high.get("highlevel", {}).get("voice_instrumental", {})
        out["moods"] = _top_labels(mood)
        out["genres"] = _top_labels(genre)
        out["danceability_prob"] = dance.get("all", {}).get("danceable") if isinstance(dance, dict) else None
        out["voice_instrumental"] = voice.get("all", {}).get("voice") if isinstance(voice, dict) else None

    return out


def _top_labels(block: Any, limit: int = 4) -> list[str]:
    if not isinstance(block, dict):
        return []
    items: list[tuple[str, float]] = []
    for key, val in block.items():
        if not key.endswith("_all"):
            continue
        if isinstance(val, dict):
            for label, prob in val.items():
                if label == "probability" or not isinstance(prob, (int, float)):
                    continue
                items.append((label.replace("_", " "), float(prob)))
    items.sort(key=lambda x: x[1], reverse=True)
    return [name for name, _ in items[:limit]]
