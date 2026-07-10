"""YouTube resolve tests (no network — mocked oEmbed)."""

from unittest.mock import patch

from fastapi.testclient import TestClient

from ai_sidecar.main import app
from ai_sidecar.youtube_resolve import parse_music_title, parse_video_id, resolve_youtube_url

client = TestClient(app)


def test_parse_video_id_watch_and_short():
    assert parse_video_id("https://www.youtube.com/watch?v=dQw4w9WgXcQ") == "dQw4w9WgXcQ"
    assert parse_video_id("https://youtu.be/dQw4w9WgXcQ") == "dQw4w9WgXcQ"


def test_parse_music_title_splits_artist_track():
    parsed = parse_music_title("Daft Punk - Harder Better Faster Stronger (Official Video)")
    assert parsed["artist"] == "Daft Punk"
    assert "Harder Better Faster Stronger" in parsed["track"]
    assert "Daft Punk" in parsed["search_query"]


@patch("ai_sidecar.youtube_resolve._fetch_yt_dlp_info", return_value=None)
@patch(
    "ai_sidecar.youtube_resolve._fetch_oembed",
    return_value={
        "title": "Artist - Song Title",
        "author_name": "ArtistVEVO",
        "thumbnail_url": "https://i.ytimg.com/vi/abc/default.jpg",
    },
)
def test_resolve_youtube_url_uses_oembed(mock_oembed, mock_ytdlp):
    payload = resolve_youtube_url("https://www.youtube.com/watch?v=abc12345678")
    assert payload["video_id"] == "abc12345678"
    assert payload["title"] == "Artist - Song Title"
    assert payload["parsed_artist"] == "Artist"
    assert payload["provider"] == "oembed"


def test_youtube_resolve_endpoint():
    with patch(
        "ai_sidecar.main.resolve_youtube_url",
        return_value={
            "video_id": "abc12345678",
            "watch_url": "https://www.youtube.com/watch?v=abc12345678",
            "title": "Test Song",
            "author_name": "Artist",
            "thumbnail_url": "",
            "duration_sec": 180.0,
            "parsed_artist": "Artist",
            "parsed_track": "Test Song",
            "search_query": "Artist Test Song",
            "tags": [],
            "categories": [],
            "description_excerpt": "",
            "provider": "oembed",
        },
    ):
        res = client.post("/youtube/resolve", json={"url": "https://youtu.be/abc12345678"})
    assert res.status_code == 200
    body = res.json()
    assert body["video_id"] == "abc12345678"
    assert body["parsed_artist"] == "Artist"
