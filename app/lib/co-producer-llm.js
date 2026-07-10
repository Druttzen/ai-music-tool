/**
 * Optional OpenAI-compatible LLM backend for Co-Producer lyrics.
 * API keys stay in localStorage only — never sent to this app's server.
 */

import { getLyricStyleDirection, prependVoiceCharacterToLyrics, resolveVoiceLyricContext } from "./lyric-generator";
import { bracketizeSunoPromptLine } from "./music-helpers";
import { formatMusicGenSketchBrief } from "./co-producer-engine";
import { safeLocalStorage } from "./safe-local-storage";
import { formatApiError } from "./api-error-messages";
import {
  formatSunoLyricSectionTag,
  getLanguageHeaderLine,
  getSunoLanguagePromptRules,
} from "./suno-lyric-languages";

export const LLM_SETTINGS_KEY = "ai_music_creator_co_producer_llm_v1";

/** Default OpenAI-compatible lyrics request timeout (ms). */
export const LLM_REQUEST_TIMEOUT_MS = 60_000;

export const DEFAULT_LLM_SETTINGS = {
  enabled: false,
  apiUrl: "https://api.openai.com/v1/chat/completions",
  apiKey: "",
  model: "gpt-4o-mini",
};

/**
 * One-click provider presets (OpenAI-compatible chat completions endpoints).
 * Local providers (Ollama, LM Studio) ignore the API key but the ready-check
 * needs a non-empty value — presets fill "local" when the key is blank.
 */
export const LLM_PROVIDER_PRESETS = [
  {
    name: "OpenAI",
    apiUrl: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4o-mini",
    local: false,
  },
  {
    name: "OpenRouter",
    apiUrl: "https://openrouter.ai/api/v1/chat/completions",
    model: "openai/gpt-4o-mini",
    local: false,
  },
  {
    name: "Groq",
    apiUrl: "https://api.groq.com/openai/v1/chat/completions",
    model: "llama-3.3-70b-versatile",
    local: false,
  },
  {
    name: "Mistral",
    apiUrl: "https://api.mistral.ai/v1/chat/completions",
    model: "mistral-small-latest",
    local: false,
  },
  {
    name: "Ollama (local)",
    apiUrl: "http://localhost:11434/v1/chat/completions",
    model: "llama3.1",
    local: true,
  },
  {
    name: "LM Studio (local)",
    apiUrl: "http://localhost:1234/v1/chat/completions",
    model: "local-model",
    local: true,
  },
];

/** Apply a provider preset onto current settings (keeps the user's key when set). */
export function applyLlmProviderPreset(settings, preset) {
  return {
    ...DEFAULT_LLM_SETTINGS,
    ...settings,
    apiUrl: preset.apiUrl,
    model: preset.model,
    apiKey: String(settings?.apiKey || "").trim() || (preset.local ? "local" : ""),
    enabled: true,
  };
}

export function loadCoProducerLlmSettings() {
  if (typeof window === "undefined") return { ...DEFAULT_LLM_SETTINGS };
  const parsed = safeLocalStorage.getJSON(LLM_SETTINGS_KEY, null);
  if (!parsed) return { ...DEFAULT_LLM_SETTINGS };
  return { ...DEFAULT_LLM_SETTINGS, ...parsed };
}

export function saveCoProducerLlmSettings(settings) {
  if (typeof window === "undefined") return;
  const next = { ...DEFAULT_LLM_SETTINGS, ...settings, apiKey: String(settings.apiKey || "") };
  safeLocalStorage.setJSON(LLM_SETTINGS_KEY, next);
}

export function isCoProducerLlmReady(settings) {
  return (
    !!settings?.enabled &&
    !!String(settings.apiKey || "").trim() &&
    !!String(settings.apiUrl || "").trim()
  );
}

/**
 * @param {object} input
 * @returns {{ system: string, user: string, styleLabel: string, styleDirection: string, mode: string, language: string }}
 */
export function buildCoProducerLlmMessages(input) {
  const styleLabel = input.lyricStyle || "Dark poetic";
  const styleDirection = getLyricStyleDirection(styleLabel);
  const theme = String(input.lyricTheme || input.idea || "the night").trim();
  const mode = input.lyricMode || "Structured Song";
  const language = input.lyricLanguage || "English";
  const languageRules = getSunoLanguagePromptRules(language);
  const langHeader = getLanguageHeaderLine(language);
  const verseTag = formatSunoLyricSectionTag("Verse 1", language);
  const chorusTag = formatSunoLyricSectionTag("Chorus", language);
  const density =
    Number(input.lyricDensity) < 35
      ? "sparse, minimal words"
      : Number(input.lyricDensity) > 70
        ? "dense, detailed flow"
        : "balanced, hook-focused";
  const voiceCtx = resolveVoiceLyricContext(input);
  const voiceSystemLines = [
    voiceCtx.vocalRole ? `Vocal role for delivery: ${voiceCtx.vocalRole}` : "",
    voiceCtx.deliveryHint ? `Trait-based delivery (match in lyrics): ${voiceCtx.deliveryHint}` : "",
    voiceCtx.vocalTag ? `Include this lyric metatag near the top when appropriate: ${voiceCtx.vocalTag}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const system = `You write lyrics for Suno AI music generation.
Style: ${styleLabel} — ${styleDirection}
Language: ${language}
${languageRules}
Lyric mode: ${mode}
${voiceSystemLines ? `${voiceSystemLines}\n` : ""}Rules:
- Use section tags like ${verseTag} and ${chorusTag} for song modes.
- ${langHeader ? `Include a top line: ${langHeader}` : "Use standard [Intro]/[Outro] tags when language is flexible."}
- For Raw Prompt mode, output bracketed [direction] lines only — no full sung lyrics.
- Keep lines short and singable; strong repeatable chorus.
- Do not explain your choices; output lyrics only.`;

  const user = `Theme: ${theme}
Mood: ${input.moodWords || "neutral"}
Structure: ${input.lyricStructure || "verse → chorus"}
Density: ${density}
Genres: ${(input.selectedGenres || []).join(", ") || "electronic"}
${voiceCtx.deliveryHint ? `Vocal delivery traits: ${voiceCtx.deliveryHint}` : ""}

Write ${mode === "Raw Prompt" ? "bracketed lyric direction" : `full lyrics in ${language} with language-declared section tags`}.`;

  return { system, user, styleLabel, styleDirection, mode, language };
}

/**
 * @param {object} input — same shape as generateCoProducerLyrics input
 * @param {object} settings
 * @param {{ timeoutMs?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<{ lyrics: string, styleLabel: string, styleDirection: string, source: "llm" }>}
 */
export async function generateLyricsWithLlm(input, settings, options = {}) {
  const { system, user, styleLabel, styleDirection, mode, language } = buildCoProducerLlmMessages(input);
  const timeoutMs = options.timeoutMs ?? LLM_REQUEST_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  if (options.signal) {
    if (options.signal.aborted) {
      clearTimeout(timeoutId);
      controller.abort();
    } else {
      options.signal.addEventListener("abort", () => controller.abort(), { once: true });
    }
  }

  try {
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
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(formatApiError(res.status, errText, "LLM request"));
    }

    const data = await res.json();
    const lyrics = String(data?.choices?.[0]?.message?.content || "").trim();
    if (!lyrics) throw new Error("LLM returned empty lyrics");

    const header = getLanguageHeaderLine(language);
    const voiceCtx = resolveVoiceLyricContext(input);
    const body =
      mode === "Raw Prompt"
        ? lyrics
        : `${header ? `${header}\n\n` : ""}[Style: ${styleLabel} — ${styleDirection}]\n\n${lyrics}`;
    return {
      lyrics: prependVoiceCharacterToLyrics(body, voiceCtx),
      styleLabel,
      styleDirection,
      source: "llm",
    };
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new Error(`LLM request timed out after ${Math.round(timeoutMs / 1000)}s`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * @param {object} input — same shape as generateCoProducerHooks input
 */
export function buildCoProducerHooksLlmMessages(input) {
  const styleLabel = input.lyricStyle || "Dark poetic";
  const styleDirection = getLyricStyleDirection(styleLabel);
  const theme = String(input.lyricTheme || input.idea || "the night").trim();
  const language = input.lyricLanguage || "English";
  const musicGenSketch = formatMusicGenSketchBrief(input.audioAnalysis);

  const system = `You write singable hook sketches for Suno AI music generation.
Style: ${styleLabel} — ${styleDirection}
Language: ${language}
Rules:
- Output exactly 3 numbered hook ideas (short, singable lines).
- Start with a bracketed title line [HOOK IDEAS · ${styleLabel}] then [Style: ...] then the three ideas.
- Do not explain your choices; output hook text only.`;

  const user = `Theme: ${theme}
Mood: ${input.moodWords || "neutral"}
Genres: ${(input.selectedGenres || []).join(", ") || "electronic"}
Vocal: ${input.vocal || "Female Lead"}
${musicGenSketch ? `Local MusicGen sketch: ${JSON.stringify(musicGenSketch)}` : ""}

Write 3 hook sketches in ${language}.`;

  return { system, user, styleLabel, styleDirection };
}

/**
 * @param {object} input
 * @param {object} settings
 * @param {{ timeoutMs?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<{ hooks: string, styleLabel: string, styleDirection: string, source: "llm" }>}
 */
export async function generateHooksWithLlm(input, settings, options = {}) {
  const { system, user, styleLabel, styleDirection } = buildCoProducerHooksLlmMessages(input);
  const timeoutMs = options.timeoutMs ?? LLM_REQUEST_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  if (options.signal) {
    if (options.signal.aborted) {
      clearTimeout(timeoutId);
      controller.abort();
    } else {
      options.signal.addEventListener("abort", () => controller.abort(), { once: true });
    }
  }

  try {
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
        temperature: 0.9,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(formatApiError(res.status, errText, "LLM request"));
    }

    const data = await res.json();
    let hooks = String(data?.choices?.[0]?.message?.content || "").trim();
    if (!hooks) throw new Error("LLM returned empty hooks");

    if (!hooks.includes("HOOK IDEAS")) {
      hooks = `${bracketizeSunoPromptLine(`HOOK IDEAS · ${styleLabel}`)}
${bracketizeSunoPromptLine(`Style: ${styleDirection}`)}

${hooks}`;
    }

    const voiceCtx = resolveVoiceLyricContext(input);
    return {
      hooks: prependVoiceCharacterToLyrics(hooks, voiceCtx),
      styleLabel,
      styleDirection,
      source: "llm",
    };
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new Error(`LLM request timed out after ${Math.round(timeoutMs / 1000)}s`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
