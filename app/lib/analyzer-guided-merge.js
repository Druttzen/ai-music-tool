/**
 * Merge drag-drop analyzer output into Suno-oriented fields (guided path limits).
 * Analyzer one-liners are telegraphic: maximum signal per character, capped so the
 * full Style box (see SUNO_STYLE_CHAR_CAP) still fits alongside DNA/SND/VOC/RULES blocks.
 */

import { clamp, uniq } from "./music-helpers";

/** Match guided workflow: few primary genres, compact sound/rhythm lists. */
export const GUIDED_MAX_GENRES = 2;
export const GUIDED_MAX_SOUNDS = 8;
export const GUIDED_MAX_RHYTHMS = 4;

/**
 * Max length for one analyzer rule line after merge.
 * Two analyzers (audio + image) can both add a line — keep each lean so RULES + template stay under {@link SUNO_STYLE_CHAR_CAP}.
 */
export const GUIDED_ANALYZER_RULE_MAX = 260;

function normalizeSpace(s) {
  return String(s).replace(/\s+/g, " ").trim();
}

/**
 * Priority-preserving trim: drop texture tokens from the end first, then secondary segments (│-separated).
 * Keeps prefix (AUDIO:/IMAGE:) and left-most metrics intact — “without losing” the highest-value tokens first.
 */
export function truncateAnalyzerRuleLine(s, max = GUIDED_ANALYZER_RULE_MAX) {
  let t = normalizeSpace(s);
  if (t.length <= max) return t;

  const sep = " │ ";
  if (t.includes(sep)) {
    const parts = t.split(sep).map((p) => p.trim()).filter(Boolean);
    while (parts.join(sep).length > max && parts.length > 1) {
      const lastIdx = parts.length - 1;
      const last = parts[lastIdx];
      if (last.includes(",")) {
        const bits = last.split(",").map((x) => x.trim()).filter(Boolean);
        bits.pop();
        if (bits.length) parts[lastIdx] = bits.join(", ");
        else parts.pop();
      } else {
        parts.pop();
      }
    }
    t = parts.join(sep);
    if (t.length <= max) return t;
    if (t.includes(",")) {
      const bits = t.split(",").map((x) => x.trim()).filter(Boolean);
      while (bits.length > 1 && bits.join(", ").length > max - 2) bits.pop();
      t = bits.join(", ");
      if (t.length <= max) return t;
    }
  }

  // Last resort: hard cap at word boundary when possible
  if (t.length <= max) return t;
  const slice = t.slice(0, max - 1);
  const sp = slice.lastIndexOf(" ");
  const cut = sp > max * 0.55 ? slice.slice(0, sp) : slice;
  return `${cut}…`;
}

/**
 * Remove previous analyzer line of this kind from Rules (one line each for audio / image).
 * Supports current compact prefixes and legacy verbose lines from older sessions.
 * @param {"audio"|"image"} kind
 */
export function stripAnalyzerRuleLine(rules, kind) {
  const prefixes =
    kind === "audio"
      ? ["AUDIO:", "AUDIO STYLE:"]
      : kind === "image"
        ? ["IMAGE:", "IMAGE STYLE:"]
        : kind === "ref"
          ? ["REF:", "STYLE-DNA:", "STYLE DNA:"]
          : [];
  return rules
    .split("\n")
    .map((l) => l.trimEnd())
    .filter((l) => {
      if (!l.length) return false;
      return !prefixes.some((p) => l.startsWith(p));
    })
    .join("\n");
}

/**
 * @param {string} rules
 * @param {"audio"|"image"} kind
 * @param {string} compactLine
 */
export function mergeAnalyzerRuleLine(rules, kind, compactLine) {
  const stripped = stripAnalyzerRuleLine(rules, kind);
  const line = truncateAnalyzerRuleLine(compactLine);
  return stripped ? `${stripped}\n${line}` : line;
}

/**
 * Comma-separated style tokens from analyzer suggestions — paste-ready for Suno Style.
 * @param {object|null} audioAnalysis
 * @param {object|null} imageAnalysis
 */
export function buildUsableAnalyzerStylePrompt(audioAnalysis, imageAnalysis) {
  const tokens = [];
  const add = (arr) => {
    for (const x of arr || []) {
      const t = normalizeSpace(x);
      if (t && t !== "—") tokens.push(t);
    }
  };

  if (audioAnalysis) {
    add(audioAnalysis.suggestedGenres);
    add(audioAnalysis.suggestedSubgenres);
    if (audioAnalysis.estimatedBpm) tokens.push(normalizeSpace(audioAnalysis.estimatedBpm));
    add(audioAnalysis.suggestedMoods);
    add(audioAnalysis.suggestedSounds);
    add(audioAnalysis.suggestedInstruments);
    add(audioAnalysis.suggestedRhythms);
    const v = normalizeSpace(audioAnalysis.vocals);
    if (v && v !== "—") tokens.push(v);
  }

  if (imageAnalysis) {
    add(imageAnalysis.suggestedGenres);
    const mood = normalizeSpace(imageAnalysis.visualMood);
    if (mood) tokens.push(mood);
    const caption = normalizeSpace(imageAnalysis.caption);
    if (caption) tokens.push(caption.slice(0, 120));
    add(imageAnalysis.suggestedSounds);
    add(imageAnalysis.suggestedRhythms);
  }

  return uniq(tokens).join(", ");
}

/**
 * Audio DNA → single high-density line (tempo, meters, groove, textures, mood patch nums).
 * @param {object} a - audioAnalysis from page state
 */
export function compactAudioStyleRule(a) {
  if (!a) return "";
  const tempo = normalizeSpace(a.estimatedBpm || "tempo ?");
  const e = clamp(Number(a.energy), 0, 100);
  const ag = clamp(Number(a.aggression), 0, 100);
  const br = clamp(Number(a.brightness), 0, 100);
  const ms = a.moodSuggestion || {};
  const dk = typeof ms.darkness === "number" ? clamp(ms.darkness, 0, 100) : null;
  const cx = typeof ms.complexity === "number" ? clamp(ms.complexity, 0, 100) : null;

  let scores = `E${e}·A${ag}·B${br}`;
  if (dk != null) scores += `·D${dk}`;
  if (cx != null) scores += `·Cx${cx}`;

  const genres = uniq(a.suggestedGenres || [])
    .slice(0, GUIDED_MAX_GENRES)
    .join("+");
  const key = normalizeSpace(a.estimatedKey || "");
  const rhythms = uniq(a.suggestedRhythms || [])
    .slice(0, GUIDED_MAX_RHYTHMS)
    .join("+");
  const sounds = uniq(a.suggestedSounds || [])
    .slice(0, GUIDED_MAX_SOUNDS)
    .join(",");

  const parts = [
    `${tempo} ${scores}`,
    genres ? `G:${genres}` : "",
    key && key !== "Key unclear" ? key : "",
    rhythms || "groove",
    sounds || "textures",
  ].filter(Boolean);

  const core = parts.join(" │ ");
  return truncateAnalyzerRuleLine(`AUDIO: ${core}`);
}

/**
 * Image DNA → compact visual metrics + merged palette (genres/rhythms/sounds caps) + full mood-slider patch as MS: vector.
 * @param {object} img - imageAnalysis from page state
 */
export function compactImageStyleRule(img) {
  if (!img) return "";
  const mood = normalizeSpace(img.visualMood || "visual");
  const rgb = normalizeSpace(img.avgColor || "").replace(/\s/g, "");
  const br = Math.round(Number(img.brightness) || 0);
  const sat = Math.round(Number(img.saturation) || 0);
  const con = Math.round(Number(img.contrast) || 0);

  const ms = img.moodSuggestion || {};
  const moodVec =
    typeof ms.energy === "number"
      ? `MS:${clamp(ms.energy)},${clamp(ms.aggression)},${clamp(ms.darkness)},${clamp(ms.emotion)},${clamp(ms.complexity)},${clamp(ms.space)}`
      : "";

  const genres = uniq(img.suggestedGenres || [])
    .slice(0, GUIDED_MAX_GENRES)
    .join("+");
  const rhythms = uniq(img.suggestedRhythms || [])
    .slice(0, GUIDED_MAX_RHYTHMS)
    .join("+");
  const sounds = uniq(img.suggestedSounds || [])
    .slice(0, GUIDED_MAX_SOUNDS)
    .join(",");

  const vis = rgb ? `${rgb} Br${br} Sa${sat} Co${con}` : `Br${br} Sa${sat} Co${con}`;
  const parts = [
    mood,
    vis,
    moodVec,
    img.caption ? `CAP:${normalizeSpace(String(img.caption).slice(0, 72))}` : "",
    genres ? `G:${genres}` : "",
    rhythms || "",
    sounds || "",
  ].filter(Boolean);

  const core = parts.join(" │ ");
  return truncateAnalyzerRuleLine(`IMAGE: ${core}`);
}

/**
 * Merge analyzer genres/sounds/rhythms with existing selections under guided caps.
 */
export function mergeGuidedGenres(prev, incoming) {
  return uniq([...(incoming || []), ...(prev || [])]).slice(0, GUIDED_MAX_GENRES);
}

export function mergeGuidedSounds(prev, incoming) {
  return uniq([...(incoming || []), ...(prev || [])]).slice(0, GUIDED_MAX_SOUNDS);
}

export function mergeGuidedRhythms(prev, incoming) {
  return uniq([...(incoming || []), ...(prev || [])]).slice(0, GUIDED_MAX_RHYTHMS);
}

/**
 * @param {object} mood - current mood
 * @param {object} patch - partial mood from analyzer moodSuggestion
 */
export function applyMoodPatch(mood, patch) {
  if (!patch || typeof patch !== "object") return mood;
  const next = { ...mood };
  for (const k of ["energy", "aggression", "darkness", "emotion", "complexity", "space"]) {
    if (typeof patch[k] === "number" && !Number.isNaN(patch[k])) {
      next[k] = clamp(patch[k], 0, 100);
    }
  }
  return next;
}

/**
 * Merge audio highlight summary into Goal when not already present.
 * @param {string} prev
 * @param {{ summary?: string, highlightStart?: number, highlightEnd?: number, highlightLabel?: string }} analysis
 * @param {(seconds: number) => string} formatTime
 */
export function mergeAudioHighlightIntoIdea(prev, analysis, formatTime) {
  const summary = (analysis.summary || analysis.trackSummary || "").trim();
  if (!summary) return prev;

  const hiLabel = analysis.highlightLabel || "section";
  const hiRange = `${formatTime(analysis.highlightStart)}–${formatTime(analysis.highlightEnd)}`;
  const add = `Reference track (highlight ${hiRange}): ${summary}`;
  const p = (prev || "").trim();

  if (!p) return add;
  if (/reference track/i.test(p)) return p;
  if (p.length < 140) return `${p}. ${add}`;
  return p;
}

/**
 * @param {string} prev
 * @param {{ summary?: string, trackSummary?: string, highlightStart?: number, highlightEnd?: number, highlightLabel?: string }} analysis
 * @param {(seconds: number) => string} formatTime
 */
export function mergeAudioHighlightIntoNotes(prev, analysis, formatTime) {
  const summary = (analysis.summary || analysis.trackSummary || "").trim();
  if (!summary) return prev;

  const hiLabel = analysis.highlightLabel || "section";
  const hiRange = `${formatTime(analysis.highlightStart)}–${formatTime(analysis.highlightEnd)}`;
  const block = `Audio highlight (${hiRange}, ${hiLabel}):\n${summary}`;
  const p = (prev || "").trim();

  if (!p) return block;
  if (p.includes("Audio highlight (")) return p;
  return `${p}\n\n${block}`;
}

/**
 * @param {string} prev
 * @param {string} visualMood
 */
export function mergeImageMoodIntoIdea(prev, visualMood) {
  const add = `Inspired by image: ${visualMood}`;
  const p = (prev || "").trim();
  if (!p) return add;
  if (p.toLowerCase().includes("inspired by image")) return p;
  if (p.length < 10) return `${p}. ${add}`;
  return p;
}

/**
 * Build a project-state patch from audio analysis for merge into Suno fields.
 * @param {object} audioAnalysis
 * @param {(seconds: number) => string} formatTime
 */
export function buildAudioAnalyzerPatch(audioAnalysis, formatTime) {
  const genreTags = [
    ...(audioAnalysis.suggestedGenres || []),
    ...(audioAnalysis.suggestedSubgenres || []),
  ];
  const soundTags = [
    ...(audioAnalysis.suggestedSounds || []),
    ...(audioAnalysis.suggestedInstruments || []),
  ];

  /** @type {Record<string, unknown>} */
  const patch = {
    tempo: audioAnalysis.estimatedBpm,
    selectedSounds: (prev) => mergeGuidedSounds(prev, soundTags),
    selectedRhythms: (prev) => mergeGuidedRhythms(prev, audioAnalysis.suggestedRhythms),
    rules: (prev) => mergeAnalyzerRuleLine(prev, "audio", compactAudioStyleRule(audioAnalysis)),
    idea: (prev) => mergeAudioHighlightIntoIdea(prev, audioAnalysis, formatTime),
    notes: (prev) => mergeAudioHighlightIntoNotes(prev, audioAnalysis, formatTime),
  };

  if (genreTags.length) {
    patch.selectedGenres = (prev) => mergeGuidedGenres(prev, genreTags);
  }
  if (audioAnalysis.moodSuggestion) {
    patch.mood = (prev) => applyMoodPatch(prev, audioAnalysis.moodSuggestion);
  }

  return patch;
}

/**
 * @param {object} imageAnalysis
 */
export function buildImageAnalyzerPatch(imageAnalysis) {
  /** @type {Record<string, unknown>} */
  const patch = {
    selectedGenres: (prev) => mergeGuidedGenres(prev, imageAnalysis.suggestedGenres),
    selectedSounds: (prev) => mergeGuidedSounds(prev, imageAnalysis.suggestedSounds),
    selectedRhythms: (prev) => mergeGuidedRhythms(prev, imageAnalysis.suggestedRhythms),
    rules: (prev) => mergeAnalyzerRuleLine(prev, "image", compactImageStyleRule(imageAnalysis)),
    idea: (prev) => mergeImageMoodIntoIdea(prev, imageAnalysis.visualMood),
  };

  if (imageAnalysis.moodSuggestion) {
    patch.mood = (prev) => applyMoodPatch(prev, imageAnalysis.moodSuggestion);
  }

  return patch;
}
