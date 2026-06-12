/**
 * Optional OpenAI-compatible LLM backend for Co-Producer lyrics.
 * API keys stay in localStorage only — never sent to this app's server.
 */

import { getLyricStyleDirection } from "./lyric-generator";
import { getSunoLanguagePromptRules } from "./suno-lyric-languages";

export const LLM_SETTINGS_KEY = "ai_music_creator_co_producer_llm_v1";

export const DEFAULT_LLM_SETTINGS = {
  enabled: false,
  apiUrl: "https://api.openai.com/v1/chat/completions",
  apiKey: "",
  model: "gpt-4o-mini",
};

export function loadCoProducerLlmSettings() {
  if (typeof window === "undefined") return { ...DEFAULT_LLM_SETTINGS };
  try {
    const raw = localStorage.getItem(LLM_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_LLM_SETTINGS };
    return { ...DEFAULT_LLM_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_LLM_SETTINGS };
  }
}

export function saveCoProducerLlmSettings(settings) {
  if (typeof window === "undefined") return;
  const next = { ...DEFAULT_LLM_SETTINGS, ...settings, apiKey: String(settings.apiKey || "") };
  localStorage.setItem(LLM_SETTINGS_KEY, JSON.stringify(next));
}

export function isCoProducerLlmReady(settings) {
  return (
    !!settings?.enabled &&
    !!String(settings.apiKey || "").trim() &&
    !!String(settings.apiUrl || "").trim()
  );
}

/**
 * @param {object} input — same shape as generateCoProducerLyrics input
 * @param {object} settings
 * @returns {Promise<{ lyrics: string, styleLabel: string, styleDirection: string, source: "llm" }>}
 */
export async function generateLyricsWithLlm(input, settings) {
  const styleLabel = input.lyricStyle || "Dark poetic";
  const styleDirection = getLyricStyleDirection(styleLabel);
  const theme = String(input.lyricTheme || input.idea || "the night").trim();
  const mode = input.lyricMode || "Structured Song";
  const language = input.lyricLanguage || "English";
  const languageRules = getSunoLanguagePromptRules(language);
  const density =
    Number(input.lyricDensity) < 35
      ? "sparse, minimal words"
      : Number(input.lyricDensity) > 70
        ? "dense, detailed flow"
        : "balanced, hook-focused";

  const system = `You write lyrics for Suno AI music generation.
Style: ${styleLabel} — ${styleDirection}
Language: ${language}
${languageRules}
Lyric mode: ${mode}
Rules:
- Use [Intro], [Verse 1], [Chorus], [Bridge], [Outro] section tags for song modes.
- For Raw Prompt mode, output bracketed [direction] lines only — no full sung lyrics.
- Keep lines short and singable; strong repeatable chorus.
- Do not explain your choices; output lyrics only.`;

  const user = `Theme: ${theme}
Mood: ${input.moodWords || "neutral"}
Structure: ${input.lyricStructure || "verse → chorus"}
Density: ${density}
Genres: ${(input.selectedGenres || []).join(", ") || "electronic"}

Write ${mode === "Raw Prompt" ? "bracketed lyric direction" : "full lyrics with section tags"}.`;

  const res = await fetch(String(settings.apiUrl).trim(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${String(settings.apiKey).trim()}`,
    },
    body: JSON.stringify({
      model: settings.model || DEFAULT_LLM_SETTINGS.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.85,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`LLM request failed (${res.status})${errText ? `: ${errText.slice(0, 120)}` : ""}`);
  }

  const data = await res.json();
  const lyrics = String(data?.choices?.[0]?.message?.content || "").trim();
  if (!lyrics) throw new Error("LLM returned empty lyrics");

  return {
    lyrics: mode === "Raw Prompt" ? lyrics : `[Style: ${styleLabel} — ${styleDirection}]\n\n${lyrics}`,
    styleLabel,
    styleDirection,
    source: "llm",
  };
}
