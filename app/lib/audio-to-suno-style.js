/**
 * Build paste-ready Suno v5.5 Style tokens from audio analysis.
 * Order: genre → mood → tempo/key → instruments → production.
 */

import {
  GUIDED_MAX_GENRES,
  GUIDED_MAX_RHYTHMS,
  GUIDED_MAX_SOUNDS,
  applyMoodPatch,
  buildAudioAnalyzerPatch,
  mergeGuidedGenres,
  mergeGuidedRhythms,
  mergeGuidedSounds,
} from "./analyzer-guided-merge";
import { uniq } from "./music-helpers";
import { SUNO_STYLE_CHAR_CAP } from "./suno-limits";

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
 * @param {object|null|undefined} report - audioAnalysis
 * @param {{ maxLen?: number }} [options]
 */
export function buildSunoV55StyleFromAudioAnalysis(report, options = {}) {
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
        tempo: null,
        vocal: null,
      },
      source: "heuristic",
    };
  }

  const genres = uniq([
    ...(report.suggestedGenres || []),
    ...(report.suggestedSubgenres || []),
  ]).slice(0, GUIDED_MAX_GENRES);

  const sounds = uniq([
    ...(report.suggestedSounds || []),
    ...(report.suggestedInstruments || []),
  ]).slice(0, GUIDED_MAX_SOUNDS);

  const rhythms = uniq(report.suggestedRhythms || []).slice(0, GUIDED_MAX_RHYTHMS);
  const moods = uniq(report.suggestedMoods || []).slice(0, 4);

  const tempo = String(report.estimatedBpm || "").trim();
  const key = String(report.estimatedKey || "").trim();
  const keyOk = key && key !== "Key unclear" ? key : "";
  const vocals = String(report.vocals || "").trim();
  const vocalOk = vocals && vocals !== "—" ? vocals : "";

  const energy = Number(report.energy);
  const aggression = Number(report.aggression);
  const production = [];
  if (Number.isFinite(energy) && energy >= 70) production.push("high-energy mix");
  if (Number.isFinite(aggression) && aggression >= 65) production.push("aggressive");
  if (Number.isFinite(energy) && energy < 40) production.push("restrained dynamics");
  if (report.chordProgression?.length) production.push("harmonic progression");

  const hfTop = Array.isArray(report.hfGenrePredictions)
    ? report.hfGenrePredictions
        .slice(0, 2)
        .map((p) => String(p.label || p.genre || "").trim())
        .filter(Boolean)
    : [];

  const segments = [
    uniq([...genres, ...hfTop]).slice(0, 3).join(", "),
    moods.join(", "),
    [tempo, keyOk].filter(Boolean).join(" "),
    sounds.slice(0, 5).join(", "),
    rhythms.slice(0, 2).join(", "),
    production.slice(0, 2).join(", "),
    vocalOk,
  ].filter(Boolean);

  const styleLine = truncateStyleLine(segments.join(", "), maxLen);

  const negativeHints = [
    Number.isFinite(energy) && energy < 35 ? "no festival drops" : "",
    vocalOk && /instrumental/i.test(vocalOk) ? "no lead vocals" : "",
    Number.isFinite(aggression) && aggression < 30 ? "no harsh distortion" : "",
  ]
    .filter(Boolean)
    .slice(0, 2)
    .join(", ");

  const summary = String(report.trackSummary || report.summary || "").trim();
  const lyricThemeHint = summary
    ? summary.replace(/\s+/g, " ").slice(0, 80)
    : moods.slice(0, 2).join(", ");

  return {
    styleLine,
    negativeHints,
    lyricThemeHint,
    pillsPatch: {
      selectedGenres: genres,
      selectedSounds: sounds,
      selectedRhythms: rhythms,
      mood: report.moodSuggestion || null,
      tempo: tempo || null,
      vocal: vocalOk || null,
    },
    source: "heuristic",
  };
}

/**
 * @param {object} audioAnalysis
 * @param {(seconds: number) => string} formatTime
 * @param {ReturnType<typeof buildSunoV55StyleFromAudioAnalysis>} [built]
 */
export function buildAudioSunoV55Patch(audioAnalysis, formatTime, built) {
  const style = built || buildSunoV55StyleFromAudioAnalysis(audioAnalysis);
  const base = buildAudioAnalyzerPatch(audioAnalysis, formatTime);
  const pills = style.pillsPatch || {};

  /** @type {Record<string, unknown>} */
  const patch = {
    ...base,
    selectedGenres: (prev) =>
      mergeGuidedGenres(prev, [
        ...(pills.selectedGenres || []),
        ...(audioAnalysis.suggestedGenres || []),
        ...(audioAnalysis.suggestedSubgenres || []),
      ]),
    selectedSounds: (prev) =>
      mergeGuidedSounds(prev, [
        ...(pills.selectedSounds || []),
        ...(audioAnalysis.suggestedSounds || []),
        ...(audioAnalysis.suggestedInstruments || []),
      ]),
    selectedRhythms: (prev) =>
      mergeGuidedRhythms(prev, pills.selectedRhythms || audioAnalysis.suggestedRhythms),
  };

  if (pills.tempo) patch.tempo = pills.tempo;
  if (pills.vocal) patch.vocal = pills.vocal;
  if (pills.mood) {
    patch.mood = (prev) => applyMoodPatch(prev, pills.mood);
  }

  if (style.styleLine) {
    // Prefill paste buffer; keep guided Style assembly (AUDIO:/MG: rules) active.
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
      const withAudio = typeof base.rules === "function" ? base.rules(prev) : String(prev || "");
      const line = `NO-GO: ${style.negativeHints}`;
      if (withAudio.includes("NO-GO:")) return withAudio;
      return withAudio ? `${withAudio}\n${line}` : line;
    };
  }

  return patch;
}
