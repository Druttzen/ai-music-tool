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

/** @deprecated use truncateAnalyzerRuleLine */
export function truncateRuleLine(s, max = GUIDED_ANALYZER_RULE_MAX) {
  return truncateAnalyzerRuleLine(s, max);
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
      : ["IMAGE:", "IMAGE STYLE:"];
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
