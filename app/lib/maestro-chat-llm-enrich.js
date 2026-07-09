/**
 * Maestro LLM artifact enrichment — shared between parse and tests.
 */

import { generateCoProducerHooks, generateCoProducerLyrics } from "./lyric-generator";
import { buildMoodWords } from "./music-helpers";
import { buildMusicGenPrompt } from "./musicgen-prompt";
import {
  buildMaestroStylePreview,
  buildMaestroVocalEmbedTurn,
  defaultMaestroSuggestions,
  mergeMaestroSnapshot,
  wantsVocalEmbedQuery,
} from "./maestro-chat-engine";
import { SUNO_STYLE_CHAR_CAP } from "./suno-limits";

function wantsStyleArtifact(text) {
  return /\b(style prompt|show the style|final prompt|suno style|paste.?ready)\b/i.test(text);
}

function wantsLyricsArtifact(text) {
  return (
    /\b(write|generate|make|give me|draft)\b.*\b(lyrics?|verse|chorus|song text)\b|\blyrics\b.*\bplease\b/i.test(
      text,
    ) || /\bwrite lyrics\b/i.test(text)
  );
}

function wantsHooksArtifact(text) {
  return /\b(hook|hooks|catchy line|chorus idea)\b/i.test(text);
}

/**
 * @param {{ reply: string, patch: object|null, commands: string[], artifacts?: object|null, suggestions?: string[] }} result
 * @param {object} snapshot
 * @param {string} [userMessage]
 */
export function enrichMaestroLlmResult(result, snapshot, userMessage = "") {
  const commands = [...(result.commands || [])];
  const merged = mergeMaestroSnapshot(snapshot, result.patch);
  const artifacts = { ...(result.artifacts || {}) };
  const lower = String(userMessage || "").toLowerCase();
  let reply = result.reply;

  if (
    (commands.includes("generateMusicGen") || commands.includes("generateMusicGenMelody")) &&
    !String(artifacts.musicGenPrompt || "").trim()
  ) {
    artifacts.musicGenPrompt = buildMusicGenPrompt({
      selectedGenres: merged.selectedGenres,
      selectedSounds: merged.selectedSounds,
      selectedRhythms: merged.selectedRhythms,
      tempo: merged.tempo,
      idea: merged.idea,
      moodWords: buildMoodWords(merged.mood),
      audioAnalysis: merged.audioAnalysis || snapshot.audioAnalysis,
    });
  }

  if (
    commands.includes("generateMusicGenMelody") &&
    !artifacts.useHighlightMelody &&
    /\bhighlight\b/i.test(lower) &&
    snapshot.hasHighlightMelody
  ) {
    artifacts.useHighlightMelody = true;
  }

  const shouldStyle =
    wantsStyleArtifact(lower) ||
    commands.includes("gotoFinal") ||
    (!!result.patch && Object.keys(result.patch).length > 0);
  if (!String(artifacts.stylePrompt || "").trim() && shouldStyle) {
    artifacts.stylePrompt = buildMaestroStylePreview(merged).slice(0, SUNO_STYLE_CHAR_CAP);
  }

  if (!String(artifacts.lyrics || "").trim() && wantsLyricsArtifact(lower)) {
    const lyricResult = generateCoProducerLyrics({
      vocal:
        merged.vocal === "Instrumental" && wantsLyricsArtifact(lower) ? "Female Lead" : merged.vocal,
      lyricStyle: merged.lyricStyle,
      lyricTheme: merged.lyricTheme || merged.idea,
      lyricMode: merged.lyricMode || "Structured Song",
      lyricLanguage: merged.lyricLanguage || "English",
      lyricStructure: merged.lyricStructure || "verse → chorus → verse → chorus",
      lyricDensity: merged.lyricDensity ?? 55,
      mood: merged.mood || {},
      moodWords: buildMoodWords(merged.mood || {}),
      selectedGenres: merged.selectedGenres || [],
      idea: merged.idea || "",
      variantSeed: Date.now() % 1000,
    });
    artifacts.lyrics = lyricResult.lyrics;
  }

  if (!String(artifacts.hooks || "").trim() && wantsHooksArtifact(lower)) {
    const hookResult = generateCoProducerHooks({
      vocal: merged.vocal,
      lyricStyle: merged.lyricStyle,
      lyricTheme: merged.lyricTheme || merged.idea,
      lyricLanguage: merged.lyricLanguage || "English",
      mood: merged.mood || {},
      selectedGenres: merged.selectedGenres || [],
      idea: merged.idea || "",
      variantSeed: Date.now() % 1000,
    });
    artifacts.hooks = hookResult.hooks;
  }

  const asksVocalEmbed =
    wantsVocalEmbedQuery(lower) || commands.includes("focusVocalEmbed");
  if (asksVocalEmbed && !String(artifacts.vocalEmbedBrief || "").trim()) {
    const embedTurn = buildMaestroVocalEmbedTurn(snapshot, userMessage);
    if (embedTurn.artifacts?.vocalEmbedBrief) {
      artifacts.vocalEmbedBrief = embedTurn.artifacts.vocalEmbedBrief;
    }
    if (!commands.includes("focusVocalEmbed") && embedTurn.commands?.includes("focusVocalEmbed")) {
      commands.push("focusVocalEmbed");
    }
    if (!String(reply || "").trim() || reply === "…") {
      reply = embedTurn.reply;
    }
  }

  const suggestions = (result.suggestions || []).filter(Boolean).slice(0, 4);
  const hasArtifacts = Object.values(artifacts).some((v) => String(v || "").trim());

  return {
    ...result,
    reply,
    commands,
    artifacts: hasArtifacts ? artifacts : null,
    suggestions: suggestions.length ? suggestions : defaultMaestroSuggestions(snapshot),
  };
}
