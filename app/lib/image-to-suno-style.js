/**
 * Build paste-ready Suno v5.5 Style tokens from image analysis (palette + caption + CLIP).
 * Order: genre → mood → instruments/sounds → production → era/vocal.
 */

import {
  GUIDED_MAX_GENRES,
  GUIDED_MAX_RHYTHMS,
  GUIDED_MAX_SOUNDS,
  applyMoodPatch,
  buildImageAnalyzerPatch,
  mergeGuidedGenres,
  mergeGuidedRhythms,
  mergeGuidedSounds,
} from "./analyzer-guided-merge";
import { uniq } from "./music-helpers";
import { SUNO_STYLE_CHAR_CAP } from "./suno-limits";

/** @type {{ re: RegExp, genres?: string[], sounds?: string[], rhythms?: string[], mood?: string[], production?: string[], era?: string[], vocal?: string }[]} */
export const CLIP_MUSIC_STYLE_HINTS = [
  { re: /ambient|drone/, genres: ["Ambient"], sounds: ["Pads, atmospheric textures"], mood: ["ethereal", "spacious"], production: ["reverb-heavy", "slow evolving"] },
  { re: /energetic pop|bright.*pop/, genres: ["Pop"], sounds: ["Bright synths", "Punchy drums"], mood: ["uplifting", "bright"], production: ["radio mix", "polished"] },
  { re: /industrial techno|techno warehouse/, genres: ["Techno", "Industrial"], sounds: ["Heavy sub bass", "Metallic percussion"], mood: ["dark", "mechanical"], production: ["warehouse", "dry kick"] },
  { re: /cinematic orchestral|trailer/, genres: ["Cinematic", "Trailer"], sounds: ["Orchestral strings", "Epic percussion"], mood: ["epic", "dramatic"], production: ["wide stereo", "cinematic mix"] },
  { re: /lo-?fi|bedroom guitar/, genres: ["Lo-fi", "Chillhop"], sounds: ["Dusty vinyl", "Soft guitar"], mood: ["chill", "nostalgic"], production: ["lo-fi", "tape warmth"] },
  { re: /heavy metal|aggression/, genres: ["Metal"], sounds: ["Distorted guitars", "Double kick"], mood: ["aggressive", "intense"], production: ["loud", "tight"] },
  { re: /acoustic folk/, genres: ["Folk", "Acoustic"], sounds: ["Acoustic guitar", "Warm vocals"], mood: ["intimate", "organic"], production: ["dry room", "natural"] },
  { re: /synthwave|80s synth|cyberpunk synth/, genres: ["Synthwave"], sounds: ["Analog synths", "Gated reverb drums"], mood: ["neon", "nostalgic"], era: ["1980s"], production: ["retro synth"] },
  { re: /trap hip-?hop|hip-?hop beat/, genres: ["Trap", "Hip-Hop"], sounds: ["808 bass", "Hi-hat rolls"], mood: ["hard", "urban"], production: ["modern trap mix"] },
  { re: /jazz lounge|saxophone/, genres: ["Jazz", "Lounge"], sounds: ["Saxophone", "Upright bass"], mood: ["smooth", "nocturnal"], production: ["warm analog"] },
  { re: /shoegaze/, genres: ["Shoegaze"], sounds: ["Washed guitars", "Reverb vocals"], mood: ["dreamy", "hazy"], production: ["wall of sound"] },
  { re: /minimal house|house groove/, genres: ["House", "Minimal"], sounds: ["Four-on-the-floor", "Deep bass"], mood: ["groovy", "hypnotic"], production: ["club mix"] },
  { re: /gothic|darkwave/, genres: ["Darkwave", "Gothic"], sounds: ["Cold synths", "Deep vocals"], mood: ["dark", "melancholic"], vocal: ["baritone"], production: ["cold reverb"] },
  { re: /tropical|dancehall/, genres: ["Dancehall", "Tropical"], sounds: ["Offbeat guitar", "Percussion"], mood: ["sunny", "upbeat"], production: ["bright"] },
  { re: /progressive electronic|spacey progressive/, genres: ["Progressive Electronic"], sounds: ["Evolving pads", "Arpeggios"], mood: ["spacey", "hypnotic"], production: ["long form"] },
  { re: /punk rock|garage energy/, genres: ["Punk", "Garage Rock"], sounds: ["Overdriven guitar", "Live drums"], mood: ["raw", "energetic"], production: ["garage", "live"] },
  { re: /chillwave|vapor/, genres: ["Chillwave", "Vaporwave"], sounds: ["Soft synths", "Slow drums"], mood: ["hazy", "nostalgic"], era: ["2010s"], production: ["soft focus"] },
  { re: /classical piano|piano ballad/, genres: ["Classical", "Ballad"], sounds: ["Grand piano"], mood: ["emotional", "intimate"], production: ["concert hall"] },
  { re: /club edm|festival drop/, genres: ["EDM", "Big Room"], sounds: ["Supersaw leads", "Big drops"], mood: ["euphoric", "high-energy"], production: ["festival", "sidechain"] },
  { re: /r&b|soul/, genres: ["R&B", "Soul"], sounds: ["Warm keys", "Smooth bass"], mood: ["intimate", "sensual"], vocal: ["smooth lead"], production: ["velvet mix"] },
];

/**
 * @param {string} label
 */
export function hintsFromClipLabel(label) {
  const lower = String(label || "").toLowerCase();
  /** @type {{ genres: string[], sounds: string[], rhythms: string[], mood: string[], production: string[], era: string[], vocal: string[] }} */
  const out = { genres: [], sounds: [], rhythms: [], mood: [], production: [], era: [], vocal: [] };
  for (const rule of CLIP_MUSIC_STYLE_HINTS) {
    if (!rule.re.test(lower)) continue;
    out.genres.push(...(rule.genres || []));
    out.sounds.push(...(rule.sounds || []));
    out.rhythms.push(...(rule.rhythms || []));
    out.mood.push(...(rule.mood || []));
    out.production.push(...(rule.production || []));
    out.era.push(...(rule.era || []));
    out.vocal.push(...(rule.vocal || []));
  }
  return out;
}

/**
 * @param {string} text
 * @param {number} max
 */
function truncateStyleLine(text, max) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const slice = t.slice(0, max - 1);
  const sp = slice.lastIndexOf(",");
  const cut = sp > max * 0.5 ? slice.slice(0, sp) : slice;
  return `${cut.trim()}…`;
}

/**
 * @param {object|null|undefined} report - imageAnalysis
 * @param {{ maxLen?: number }} [options]
 */
export function buildSunoV55StyleFromImageAnalysis(report, options = {}) {
  const maxLen = options.maxLen ?? Math.min(280, SUNO_STYLE_CHAR_CAP);
  if (!report || typeof report !== "object") {
    return {
      styleLine: "",
      negativeHints: "",
      lyricThemeHint: "",
      pillsPatch: {
        selectedGenres: [],
        selectedSounds: [],
        selectedRhythms: [],
        mood: null,
      },
      source: "heuristic",
    };
  }

  const clipTags = Array.isArray(report.clipTags) ? report.clipTags : [];
  /** @type {ReturnType<typeof hintsFromClipLabel>} */
  const fromClip = { genres: [], sounds: [], rhythms: [], mood: [], production: [], era: [], vocal: [] };
  for (const tag of clipTags.slice(0, 5)) {
    const h = hintsFromClipLabel(tag.label);
    fromClip.genres.push(...h.genres);
    fromClip.sounds.push(...h.sounds);
    fromClip.rhythms.push(...h.rhythms);
    fromClip.mood.push(...h.mood);
    fromClip.production.push(...h.production);
    fromClip.era.push(...h.era);
    fromClip.vocal.push(...h.vocal);
  }

  const genres = uniq([
    ...fromClip.genres,
    ...(report.suggestedGenres || []),
  ]).slice(0, GUIDED_MAX_GENRES);

  const sounds = uniq([
    ...fromClip.sounds,
    ...(report.suggestedSounds || []),
  ]).slice(0, GUIDED_MAX_SOUNDS);

  const rhythms = uniq([
    ...fromClip.rhythms,
    ...(report.suggestedRhythms || []),
  ]).slice(0, GUIDED_MAX_RHYTHMS);

  const visualMood = String(report.visualMood || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const moodTokens = uniq([...fromClip.mood, ...visualMood]).slice(0, 4);
  const production = uniq(fromClip.production).slice(0, 3);
  const era = uniq(fromClip.era).slice(0, 1);
  const vocal = uniq(fromClip.vocal).slice(0, 1);

  const caption = String(report.caption || "").trim();
  const captionHint = caption
    ? caption
        .replace(/^(a |an |the )/i, "")
        .slice(0, 64)
    : "";

  // genre → mood → instruments → production → era/vocal
  const segments = [
    genres.join(", "),
    moodTokens.join(", "),
    sounds.slice(0, 5).join(", "),
    production.join(", "),
    [...era, ...vocal].join(", "),
    captionHint ? `inspired by ${captionHint}` : "",
  ].filter(Boolean);

  const styleLine = truncateStyleLine(segments.join(", "), maxLen);

  const negativeHints = [
    report.brightness != null && Number(report.brightness) < 80 ? "no bright major pop cheer" : "",
    report.saturation != null && Number(report.saturation) < 30 ? "no neon supersaw overload" : "",
    fromClip.genres.some((g) => /ambient|classical/i.test(g)) ? "no heavy drops" : "",
  ]
    .filter(Boolean)
    .slice(0, 2)
    .join(", ");

  const lyricThemeHint = captionHint || moodTokens.slice(0, 2).join(", ") || "";

  return {
    styleLine,
    negativeHints,
    lyricThemeHint,
    pillsPatch: {
      selectedGenres: genres,
      selectedSounds: sounds,
      selectedRhythms: rhythms,
      mood: report.moodSuggestion || null,
    },
    source: "heuristic",
  };
}

/**
 * Project patch: merge pills + IMAGE rule + paste-ready Style + optional theme.
 * @param {object} imageAnalysis
 * @param {ReturnType<typeof buildSunoV55StyleFromImageAnalysis>} [built]
 */
export function buildImageSunoV55Patch(imageAnalysis, built) {
  const style = built || buildSunoV55StyleFromImageAnalysis(imageAnalysis);
  const base = buildImageAnalyzerPatch(imageAnalysis);
  const pills = style.pillsPatch || {};

  /** @type {Record<string, unknown>} */
  const patch = {
    ...base,
    selectedGenres: (prev) => mergeGuidedGenres(prev, pills.selectedGenres || imageAnalysis.suggestedGenres),
    selectedSounds: (prev) => mergeGuidedSounds(prev, pills.selectedSounds || imageAnalysis.suggestedSounds),
    selectedRhythms: (prev) => mergeGuidedRhythms(prev, pills.selectedRhythms || imageAnalysis.suggestedRhythms),
  };

  if (pills.mood) {
    patch.mood = (prev) => applyMoodPatch(prev, pills.mood);
  }

  if (style.styleLine) {
    // Prefill paste buffer; keep guided Style assembly (IMAGE:/AUDIO: rules) active.
    patch.sunoPasteStyle = style.styleLine;
  }

  if (style.lyricThemeHint) {
    patch.lyricTheme = (prev) => {
      const p = String(prev || "").trim();
      if (p) return p;
      return style.lyricThemeHint;
    };
  }

  if (style.negativeHints) {
    patch.rules = (prev) => {
      const withImage = typeof base.rules === "function" ? base.rules(prev) : String(prev || "");
      const line = `NO-GO: ${style.negativeHints}`;
      if (withImage.includes("NO-GO:")) return withImage;
      return withImage ? `${withImage}\n${line}` : line;
    };
  }

  return patch;
}
