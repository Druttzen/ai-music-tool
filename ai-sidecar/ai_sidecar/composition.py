"""Learned local prompt planning through ACE-Step's cached 5Hz language model."""

import json
import math
import re
from typing import Any

from .acestep_bridge import _auth_headers, acestep_api_url


def _data(response: Any) -> dict[str, Any]:
    response.raise_for_status()
    body = response.json()
    if not isinstance(body, dict) or body.get("code", 200) != 200 or not isinstance(body.get("data"), dict):
        raise RuntimeError("Local AI composition failed: " + str(body.get("error") if isinstance(body, dict) else "invalid response"))
    return body["data"]


def plan_composition(prompt: str, *, lyrics: str = "", duration_sec: float | None = None,
                     instrumental: bool = True, bpm: int | None = None,
                     key_scale: str = "", vocal_language: str = "", on_progress=None,
                     check_cancelled=None) -> dict[str, Any]:
    """Use trained weights, never substitute a rule/template planner on failure.

    Existing server model selection is preserved. Managed servers choose their LM
    at startup; external servers must have enabled their own local LM.
    """
    import httpx

    text = str(prompt or "").strip()
    if not text:
        raise ValueError("prompt is required")
    duration = float(duration_sec if duration_sec is not None else 60)
    if not math.isfinite(duration) or not 10 <= duration <= 600:
        raise ValueError("composition duration must be between 10 and 600 seconds")
    instrumental = bool(instrumental and not lyrics.strip())
    language = vocal_language or ("unknown" if instrumental else "en")
    metadata = {"duration": duration}
    if bpm is not None:
        metadata["bpm"] = max(30, min(int(bpm), 300))
    if key_scale:
        metadata["key_scale"] = key_scale
    if language != "unknown":
        metadata["language"] = language
    headers = _auth_headers()
    base = acestep_api_url()
    if check_cancelled:
        check_cancelled()
    if on_progress:
        on_progress(0.10, "AI composing the musical idea")
    try:
        with httpx.Client(timeout=240) as client:
            caption = text
            planned_lyrics = lyrics or "[Instrumental]"
            method = "format-input"
            if not instrumental and not lyrics.strip():
                word_budget = int(duration * 2)
                short_song_query = (f"{text}\nCompose a complete {duration:g}-second song. "
                    f"Keep sung lyrics within {word_budget} words and fit the sections "
                    "and ending into that duration.")
                for attempt in range(3):
                    sample = _data(client.post(f"{base}/v1/create_sample", headers=headers,
                        json={"query": short_song_query, "instrumental": False,
                              "vocal_language": language, "temperature": 0.85}))
                    caption = str(sample.get("caption") or "").strip()
                    planned_lyrics = str(sample.get("lyrics") or "").strip()
                    sung_words = re.sub(r"\[[^\]]*\]", "", planned_lyrics).split()
                    language_tags = re.findall(r"\[([a-z]{2,3})\]", planned_lyrics)
                    valid_language = sample.get("vocal_language") == language and all(tag == language for tag in language_tags)
                    if language in {"en", "sv", "de", "es", "fr"} and re.search(r"[\u3400-\u9fff]", planned_lyrics):
                        valid_language = False
                    if caption and sung_words and len(sung_words) <= word_budget and valid_language:
                        break
                    if check_cancelled:
                        check_cancelled()
                    if on_progress:
                        on_progress(0.10, f"AI revising lyrics to fit duration and language ({attempt + 1}/3)")
                else:
                    raise RuntimeError("AI lyrics did not fit the selected language and duration. "
                                       "Choose a longer song or supply your own short lyrics.")
                method = "create-sample+format-input"
            if check_cancelled:
                check_cancelled()
            # The formatter receives the requested duration and musical constraints.
            # release_task sample_mode would otherwise replace the user's duration.
            plan = _data(client.post(f"{base}/format_input", headers=headers, json={
                "prompt": caption, "lyrics": planned_lyrics, "temperature": 0.85,
                "param_obj": json.dumps(metadata)}))
            inventory = _data(client.get(f"{base}/v1/model_inventory", headers=headers))
    except httpx.HTTPError as exc:
        raise RuntimeError("Local AI composer unavailable. Enable the cached ACE-Step language model; "
                           "composition requires it and cannot run with LM disabled.") from exc
    caption = str(plan.get("caption") or "").strip()
    planner = str(inventory.get("loaded_lm_model") or "").strip()
    if not caption or not inventory.get("llm_initialized") or not planner.startswith("acestep-5Hz-lm-"):
        raise RuntimeError("Local AI composition did not return a verified loaded music planner")
    if check_cancelled:
        check_cancelled()
    return {"original_prompt": text, "caption": caption,
            "generation_prompt": text + "\n\n" + caption,
            # Instrumental section tags are retained as a plan; no sung words are requested.
            # Preserve accepted generated words too; formatting must not expand them
            # into an overlong song or replace the selected language.
            "lyrics": lyrics if lyrics.strip() else planned_lyrics if not instrumental else str(plan.get("lyrics") or planned_lyrics),
            "bpm": metadata.get("bpm", plan.get("bpm")),
            "key_scale": key_scale or str(plan.get("key_scale") or ""),
            "time_signature": str(plan.get("time_signature") or ""),
            "duration_sec": duration, "suggested_duration_sec": plan.get("duration"),
            "vocal_language": language,
            "instrumental": instrumental, "planner_model": planner,
            "method": method, "semantic_planning_requested": True}
