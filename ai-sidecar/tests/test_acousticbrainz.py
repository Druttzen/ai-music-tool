"""Tests for AcousticBrainz lookup (mocked HTTP)."""

from __future__ import annotations

from unittest.mock import patch
from urllib.error import URLError
from urllib.request import Request

from ai_sidecar.acousticbrainz import _get_json, fetch_acousticbrainz_features


def test_fetch_acousticbrainz_none_when_empty_mbid():
    assert fetch_acousticbrainz_features("") is None


def test_get_json_sets_accept_header_without_nameerror(monkeypatch):
    captured = {}

    def fake_urlopen(req, timeout=12):
        assert isinstance(req, Request)
        captured["accept"] = req.get_header("Accept")
        raise URLError("offline")

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)
    assert _get_json("https://example.invalid/ab") is None
    assert captured["accept"] == "application/json"


@patch("ai_sidecar.acousticbrainz._get_json")
def test_fetch_acousticbrainz_merges_low_and_high(mock_get):
    mbid = "11111111-1111-1111-1111-111111111111"

    def side(url):
        if "/low-level" in url:
            return {
                "tonal": {"key_key": "C", "key_scale": "major", "key_strength": 0.8},
                "rhythm": {"bpm": 120.0, "danceability": 0.6},
                "lowlevel": {"average_loudness": -12.0},
            }
        if "/high-level" in url:
            return {
                "highlevel": {
                    "mood_": {"mood_happy_all": {"happy": 0.9, "sad": 0.1}},
                    "genre_": {"genre_rock_all": {"rock": 0.7, "pop": 0.2}},
                }
            }
        return None

    mock_get.side_effect = side
    out = fetch_acousticbrainz_features(mbid)
    assert out is not None
    assert out["recording_mbid"] == mbid
    assert out["bpm"] == 120.0
    assert out["key_key"] == "C"
    assert "happy" in out["moods"] or out["moods"]
