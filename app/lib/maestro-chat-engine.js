/**
 * Maestro Chat — conversational music-creator engine.
 * Parses natural-language studio direction into project patches + Suno-ready
 * artifacts. Fully offline (heuristic NLU); optional LLM backend lives in
 * maestro-chat-llm.js. Pure functions — no React, safe for unit tests.
 */

import {
  genreOptions,
  lyricLanguageOptions,
  rhythmOptions,
  soundOptions,
  stylePresets,
  vocalOptions,
} from "./music-config";
import { buildMoodWords, clamp, uniq } from "./music-helpers";
import { generateCoProducerHooks, generateCoProducerLyrics } from "./lyric-generator";
import { buildSunoPastedStyleLine } from "./suno-guided-workflow";
import { SUNO_STYLE_CHAR_CAP } from "./suno-limits";

export const MAESTRO_CHAT_STORAGE_KEY = "ai_music_creator_maestro_chat_v1";
export const MAESTRO_CHAT_MAX_MESSAGES = 60;

/** Keys Maestro is allowed to patch on the project (panel maps them to setters). */
export const MAESTRO_PATCHABLE_KEYS = [
  "idea",
  "tempo",
  "structure",
  "selectedGenres",
  "selectedRhythms",
  "selectedSounds",
  "vocal",
  "instrumentalVocalFx",
  "mood",
  "lyricTheme",
  "lyricLanguage",
  "lyricStyle",
  "rules",
];

const MOOD_KEYWORDS = [
  { re: /\b(darker|dark|sinister|evil|shadow|haunt(?:ed|ing)?)\b/, key: "darkness", delta: +18 },
  { re: /\b(brighter|bright|happy|sunny|uplift(?:ing)?|joyful)\b/, key: "darkness", delta: -18 },
  { re: /\b(harder|aggressive|angry|brutal|heavy|violent)\b/, key: "aggression", delta: +18 },
  { re: /\b(softer|soft|gentle|calm(?:er)?|relax(?:ed|ing)?|chill)\b/, key: "aggression", delta: -18 },
  { re: /\b(energetic|high[ -]?energy|intense|powerful|banger)\b/, key: "energy", delta: +15 },
  { re: /\b(sleepy|slow[ -]?burn|laid[ -]?back|mellow)\b/, key: "energy", delta: -15 },
  { re: /\b(emotional|heartfelt|sad|melancholic|touching)\b/, key: "emotion", delta: +18 },
  { re: /\b(cold|detached|clinical|robotic)\b/, key: "emotion", delta: -15 },
  { re: /\b(complex|layered|detailed|busy|intricate)\b/, key: "complexity", delta: +15 },
  { re: /\b(minimal(?:istic)?|simple|stripped)\b/, key: "complexity", delta: -18 },
  { re: /\b(spacious|wide|atmospheric|epic|cinematic|huge)\b/, key: "space", delta: +15 },
  { re: /\b(dry|tight|intimate|close)\b/, key: "space", delta: -15 },
];

const VOCAL_KEYWORDS = [
  { re: /\b(no vocals?|instrumental(?: only)?|without vocals?)\b/, value: "Instrumental" },
  { re: /\b(female (?:lead |singer|voice|vocals?)|woman sing)/, value: "Female Lead" },
  { re: /\b(male (?:lead |singer|voice|vocals?)|man sing)/, value: "Male Lead" },
  { re: /\bduet\b/, value: "Duet (M/F)" },
  { re: /\bchoir\b/, value: "Choir" },
  { re: /\b(spoken word|talking|narration)\b/, value: "Spoken Word" },
  { re: /\b(whisper(?:ed|ing)?)\b/, value: "Whispered Lead" },
  { re: /\b(raspy|gritty voice|rough voice)\b/, value: "Raspy Lead" },
  { re: /\b(autotune[d]?)\b/, value: "Autotuned Vocal" },
  { re: /\b(robot(?:ic)? (?:voice|vocals?)|vocoder)\b/, value: "Robotic" },
  { re: /\b(vocal chops?)\b/, value: "Vocal Chops" },
  { re: /\b(rap(?:per|ping)?|mc verse)\b/, value: "Male Lead" },
  { re: /\b(crowd chant|stadium chant)\b/, value: "Crowd Chant" },
  { re: /\b(beatbox)\b/, value: "Beatbox" },
  { re: /\b(harmonies|stacked vocals)\b/, value: "Stacked Harmonies" },
];

/** Longest-first option list for greedy phrase matching. */
function sortedByLength(options) {
  return [...options].sort((a, b) => b.length - a.length);
}

const GENRES_BY_LENGTH = sortedByLength(genreOptions);
const SOUNDS_BY_LENGTH = sortedByLength(soundOptions);
const RHYTHMS_BY_LENGTH = sortedByLength(rhythmOptions);

/**
 * Greedy catalog matching: find option labels appearing in the message.
 * Consumes matched spans so "deep house" doesn't also match "house".
 * @param {string} message
 * @param {string[]} optionsByLength
 * @param {number} max
 */
export function matchCatalogOptions(message, optionsByLength, max = 3) {
  let haystack = ` ${message.toLowerCase()} `;
  const found = [];
  for (const option of optionsByLength) {
    if (found.length >= max) break;
    const needle = option.toLowerCase();
    if (needle.length < 3) continue;
    const idx = haystack.indexOf(needle);
    if (idx === -1) continue;
    const before = haystack[idx - 1];
    const after = haystack[idx + needle.length];
    const boundary = /[^a-z0-9&]/;
    if (before && !boundary.test(before)) continue;
    if (after && !boundary.test(after)) continue;
    found.push(option);
    haystack = haystack.slice(0, idx) + "·".repeat(needle.length) + haystack.slice(idx + needle.length);
  }
  return found;
}

/** @param {string} message */
export function parseTempo(message, currentTempo = "") {
  const explicit = message.match(/(\d{2,3})\s*bpm/i);
  if (explicit) {
    const bpm = clamp(Number(explicit[1]), 40, 260);
    return `${bpm} BPM`;
  }
  const current = Number((String(currentTempo).match(/(\d{2,3})/) || [])[1]) || 120;
  if (/\b(way faster|much faster)\b/i.test(message)) return `${clamp(current + 20, 40, 260)} BPM`;
  if (/\bfaster\b|\bspeed(?:\s*it)?\s*up\b/i.test(message)) return `${clamp(current + 10, 40, 260)} BPM`;
  if (/\b(way slower|much slower)\b/i.test(message)) return `${clamp(current - 20, 40, 260)} BPM`;
  if (/\bslower\b|\bslow(?:\s*it)?\s*down\b/i.test(message)) return `${clamp(current - 10, 40, 260)} BPM`;
  return null;
}

/** @param {string} message */
export function parseLyricTheme(message) {
  const m = message.match(
    /\b(?:lyrics?|song|track|write|sing)\s+about\s+(.{3,120}?)(?:[.!?]|$)/i,
  );
  if (m) return m[1].trim();
  const about = message.match(/\babout\s+(.{3,120}?)(?:[.!?]|$)/i);
  if (about && /\blyric|\bsong|\bwrite|\bsing|\btheme/i.test(message)) return about[1].trim();
  return null;
}

/** @param {string} message */
export function parseLanguage(message) {
  const lower = message.toLowerCase();
  if (!/\b(in|language|lyrics?|sing|sung)\b/.test(lower)) return null;
  for (const lang of lyricLanguageOptions) {
    const needle = lang.toLowerCase();
    if (needle.length < 4) continue;
    if (lower.includes(needle)) return lang;
  }
  return null;
}

/**
 * Mood patch from message keywords.
 * @param {string} message
 * @param {Record<string, number>} mood - current mood
 */
export function parseMoodPatch(message, mood) {
  const lower = message.toLowerCase();
  let next = null;
  for (const { re, key, delta } of MOOD_KEYWORDS) {
    if (!re.test(lower)) continue;
    next = next || { ...mood };
    next[key] = clamp((next[key] ?? 50) + delta, 0, 100);
  }
  return next;
}

/** @param {string} message */
export function parseVocal(message) {
  const lower = message.toLowerCase();
  for (const { re, value } of VOCAL_KEYWORDS) {
    if (re.test(lower)) return value;
  }
  for (const option of vocalOptions) {
    if (lower.includes(option.toLowerCase())) return option;
  }
  return null;
}

function pickRandom(list, rng = Math.random) {
  return list[Math.floor(rng() * list.length)];
}

/**
 * Random full direction from factory presets (used by "surprise me").
 * @param {() => number} [rng]
 */
export function buildSurprisePatch(rng = Math.random) {
  const names = Object.keys(stylePresets);
  const name = pickRandom(names, rng);
  const p = stylePresets[name];
  return {
    presetName: name,
    patch: {
      selectedGenres: [...p.genres],
      selectedRhythms: [...p.rhythms],
      selectedSounds: [...p.sounds],
      vocal: p.vocal,
      tempo: p.tempo,
      structure: p.structure,
    },
  };
}

/**
 * Snapshot merged with a pending patch (for artifact building).
 */
function mergeSnapshot(snapshot, patch) {
  return { ...snapshot, ...(patch || {}) };
}

/** Build the ≤1000-char Suno Style line from a (possibly patched) snapshot. */
export function buildMaestroStylePreview(snapshot) {
  const merged = snapshot;
  return buildSunoPastedStyleLine({
    selectedGenres: merged.selectedGenres || [],
    tempo: merged.tempo || "",
    moodWords: buildMoodWords(merged.mood || {}),
    selectedSounds: merged.selectedSounds || [],
    selectedRhythms: merged.selectedRhythms || [],
    vocal: merged.vocal || "Instrumental",
    instrumentalVocalFx: !!merged.instrumentalVocalFx,
    idea: merged.idea || "",
    rules: merged.rules || "",
    voiceStyleLine: merged.voiceStyleLine || "",
  });
}

function describePatch(patch) {
  const parts = [];
  if (patch.selectedGenres?.length) parts.push(`genre → ${patch.selectedGenres.join(" + ")}`);
  if (patch.tempo) parts.push(`tempo → ${patch.tempo}`);
  if (patch.vocal) parts.push(`vocals → ${patch.vocal}`);
  if (patch.mood) parts.push("mood sliders tuned");
  if (patch.selectedSounds?.length) parts.push(`sounds → ${patch.selectedSounds.slice(0, 3).join(", ")}`);
  if (patch.selectedRhythms?.length) parts.push(`rhythm → ${patch.selectedRhythms.join(", ")}`);
  if (patch.lyricTheme) parts.push(`lyric theme → “${patch.lyricTheme}”`);
  if (patch.lyricLanguage) parts.push(`language → ${patch.lyricLanguage}`);
  if (patch.structure) parts.push("structure set");
  if (patch.idea) parts.push(`idea captured`);
  return parts;
}

const HELP_TEXT = `I'm Maestro — your chat co-producer. Talk to me like a bandmate:
• "dark techno at 140 bpm with a female vocal"
• "make it darker and more minimal"
• "write lyrics about neon rain in Spanish"
• "give me hooks" / "show the style prompt"
• "surprise me" for a fresh direction
Everything I set lands in your project instantly — then copy the Style & Lyrics fields straight into Suno.`;

/**
 * Heuristic chat turn: message + project snapshot → reply, patch, artifacts.
 * @param {string} message
 * @param {object} snapshot - current project fields (idea, tempo, mood, selections, lyric fields)
 * @param {{ rng?: () => number }} [options]
 * @returns {{ reply: string, patch: Record<string, unknown>|null, artifacts: { stylePrompt?: string, lyrics?: string, hooks?: string }, suggestions: string[] }}
 */
export function buildMaestroReply(message, snapshot, options = {}) {
  const rng = options.rng || Math.random;
  const text = String(message || "").trim();
  const lower = text.toLowerCase();
  const artifacts = {};
  let patch = {};
  let replyParts = [];
  let suggestions = [];

  if (!text || /^(help|\?|what can you do)/i.test(lower)) {
    return {
      reply: HELP_TEXT,
      patch: null,
      artifacts,
      suggestions: ["Surprise me", "Show the style prompt", "Write lyrics about the night"],
    };
  }

  // --- one-shot commands -------------------------------------------------
  if (/\b(surprise me|random (?:track|direction|style)|roll the dice)\b/i.test(lower)) {
    const surprise = buildSurprisePatch(rng);
    patch = surprise.patch;
    const preview = buildMaestroStylePreview(mergeSnapshot(snapshot, patch));
    artifacts.stylePrompt = preview;
    return {
      reply: `Rolled the dice — landed on a “${surprise.presetName}” direction: ${patch.selectedGenres.join(" + ")} at ${patch.tempo}, ${patch.vocal.toLowerCase()} vocals. Style preview below; say "make it darker", "faster", or "write lyrics" to shape it.`,
      patch,
      artifacts,
      suggestions: ["Make it darker", "Write lyrics about power", "Show the style prompt"],
    };
  }

  const wantsStyle = /\b(show|preview|build|give me|copy)\b.*\b(style|prompt)\b|\bstyle prompt\b/i.test(lower);
  const wantsLyrics = /\b(write|generate|make|give me|draft)\b.*\b(lyrics?|verse|chorus|song text)\b|\blyrics\b.*\bplease\b/i.test(lower);
  const wantsHooks = /\b(hook|hooks|catchy line|chorus idea)\b/i.test(lower);

  // --- field extraction ---------------------------------------------------
  const genres = matchCatalogOptions(text, GENRES_BY_LENGTH, 3);
  if (genres.length) patch.selectedGenres = uniq(genres);

  const tempo = parseTempo(text, snapshot.tempo);
  if (tempo) patch.tempo = tempo;

  const vocal = parseVocal(text);
  if (vocal) {
    patch.vocal = vocal;
    if (vocal === "Instrumental" && /\bvocal fx|chops as texture\b/i.test(lower)) {
      patch.instrumentalVocalFx = true;
    }
  }

  const moodPatch = parseMoodPatch(text, snapshot.mood || {});
  if (moodPatch) patch.mood = moodPatch;

  const sounds = matchCatalogOptions(text, SOUNDS_BY_LENGTH, 4);
  if (sounds.length) {
    patch.selectedSounds = uniq([...(snapshot.selectedSounds || []), ...sounds]).slice(0, 8);
  }

  const rhythms = matchCatalogOptions(text, RHYTHMS_BY_LENGTH, 2);
  if (rhythms.length) {
    patch.selectedRhythms = uniq([...(snapshot.selectedRhythms || []), ...rhythms]).slice(0, 4);
  }

  const theme = parseLyricTheme(text);
  if (theme) patch.lyricTheme = theme;

  const language = parseLanguage(text);
  if (language) patch.lyricLanguage = language;

  // Long free-text with no structured hits → treat as the track idea.
  const hasFieldHits = Object.keys(patch).length > 0;
  if (!hasFieldHits && !wantsStyle && !wantsLyrics && !wantsHooks && text.length >= 12) {
    patch.idea = text.slice(0, 240);
  }

  const merged = mergeSnapshot(snapshot, patch);

  // --- artifacts -----------------------------------------------------------
  if (wantsLyrics || theme) {
    const result = generateCoProducerLyrics({
      vocal: merged.vocal === "Instrumental" && (wantsLyrics || theme) ? "Female Lead" : merged.vocal,
      lyricStyle: merged.lyricStyle,
      lyricTheme: merged.lyricTheme || theme || merged.idea,
      lyricMode: merged.lyricMode || "Structured Song",
      lyricLanguage: merged.lyricLanguage || "English",
      lyricStructure: merged.lyricStructure || "verse → chorus → verse → chorus",
      lyricDensity: merged.lyricDensity ?? 55,
      mood: merged.mood || {},
      moodWords: buildMoodWords(merged.mood || {}),
      selectedGenres: merged.selectedGenres || [],
      idea: merged.idea || "",
      variantSeed: Math.floor(rng() * 1000),
    });
    artifacts.lyrics = result.lyrics;
    replyParts.push(
      `Lyrics drafted in your “${result.styleLabel}” style${merged.lyricLanguage && merged.lyricLanguage !== "English" ? ` (${merged.lyricLanguage})` : ""}.`,
    );
    suggestions.push("Another lyrics take", "Show the style prompt");
  }

  if (wantsHooks) {
    const hooks = generateCoProducerHooks({
      vocal: merged.vocal,
      lyricStyle: merged.lyricStyle,
      lyricTheme: merged.lyricTheme || merged.idea,
      lyricLanguage: merged.lyricLanguage || "English",
      mood: merged.mood || {},
      selectedGenres: merged.selectedGenres || [],
      variantSeed: Math.floor(rng() * 1000),
    });
    artifacts.hooks = hooks.hooks;
    replyParts.push("Hook sketches below — steal the best line for your chorus.");
  }

  if (wantsStyle || (!wantsLyrics && !wantsHooks && hasFieldHits)) {
    artifacts.stylePrompt = buildMaestroStylePreview(merged);
  }

  // --- reply text ----------------------------------------------------------
  const changed = describePatch(patch);
  if (changed.length) {
    replyParts.unshift(`Locked in: ${changed.join(" · ")}.`);
  } else if (patch.idea) {
    replyParts.unshift(`Got it — using that as the track idea.`);
  }

  if (wantsStyle && artifacts.stylePrompt) {
    replyParts.push(
      `Style field is ${artifacts.stylePrompt.length}/${SUNO_STYLE_CHAR_CAP} characters — paste-ready for Suno.`,
    );
  }

  if (!replyParts.length) {
    replyParts.push(
      `I didn't catch a specific direction there. Try a genre, a BPM, a mood ("darker", "more epic"), vocals, or ask for lyrics/hooks. Say "help" for examples.`,
    );
    suggestions = ["Help", "Surprise me", "Show the style prompt"];
  } else if (!suggestions.length) {
    suggestions = ["Make it darker", "Write lyrics", "Show the style prompt", "Surprise me"];
  }

  return {
    reply: replyParts.join(" "),
    patch: Object.keys(patch).length ? patch : null,
    artifacts,
    suggestions: suggestions.slice(0, 4),
  };
}

/** Sanitize an arbitrary patch object down to allowed keys and value shapes. */
export function sanitizeMaestroPatch(patch, snapshot) {
  if (!patch || typeof patch !== "object") return null;
  const out = {};
  for (const key of MAESTRO_PATCHABLE_KEYS) {
    if (!(key in patch)) continue;
    const value = patch[key];
    if (key === "mood") {
      if (value && typeof value === "object") {
        const mood = { ...(snapshot.mood || {}) };
        for (const k of ["darkness", "energy", "aggression", "emotion", "complexity", "space"]) {
          if (typeof value[k] === "number" && Number.isFinite(value[k])) {
            mood[k] = clamp(Math.round(value[k]), 0, 100);
          }
        }
        out.mood = mood;
      }
      continue;
    }
    if (["selectedGenres", "selectedRhythms", "selectedSounds"].includes(key)) {
      if (Array.isArray(value)) {
        out[key] = uniq(value.map((v) => String(v)).filter(Boolean)).slice(0, 8);
      }
      continue;
    }
    if (key === "instrumentalVocalFx") {
      out[key] = !!value;
      continue;
    }
    if (typeof value === "string" && value.trim()) out[key] = value.trim().slice(0, 400);
  }
  return Object.keys(out).length ? out : null;
}

/** Initial assistant greeting for a fresh chat session. */
export function createMaestroGreeting() {
  return {
    role: "assistant",
    text: `Hey — Maestro here, your chat co-producer. Describe the track you hear in your head ("melodic techno at 126 bpm, hypnotic, female whisper vocal") and I'll set up the whole project while we talk. Ask for lyrics, hooks, or the final Suno style prompt any time.`,
    suggestions: ["Surprise me", "Dark techno at 140 bpm", "Write lyrics about the night", "Help"],
  };
}
