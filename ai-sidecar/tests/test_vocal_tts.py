"""Optional transformers TTS fallback (MMS). Tests never download weights."""

from ai_sidecar.vocal_tts import try_transformers_tts, vocal_tts_engine_ready


def test_vocal_tts_off_env(monkeypatch):
    monkeypatch.setenv("AIMC_VOCAL_TTS_OFF", "1")
    assert vocal_tts_engine_ready() is False
    assert try_transformers_tts({"lyrics": "hello"}, length=100, sample_rate=16000) is None


def test_lyrics_from_plan_prefers_lyrics_field():
    from ai_sidecar.vocal_tts import _lyrics_from_plan

    text = _lyrics_from_plan({"lyrics": "Verse words", "sections": [{"text": "ignored"}]})
    assert text == "Verse words"


def test_lyrics_from_plan_falls_back_to_sections():
    from ai_sidecar.vocal_tts import _lyrics_from_plan

    text = _lyrics_from_plan(
        {
            "lyrics": "",
            "sections": [
                {"text": "One"},
                {"lyrics": "Two"},
            ],
        }
    )
    assert "One" in text
    assert "Two" in text
