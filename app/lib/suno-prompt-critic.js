/**
 * Suno 5.5 prompt quality critic — score style + lyrics before generation.
 */

import { SUNO_LYRICS_CHAR_TYPICAL_MAX, SUNO_STYLE_CHAR_CAP } from "./suno-limits";

const CONFLICT_PAIRS = [
  ["calm", "aggressive"],
  ["calm", "distorted"],
  ["acoustic", "supersaw"],
  ["acoustic", "heavy sub"],
  ["whisper", "belted"],
  ["slow", "uptempo"],
  ["instrumental", "lead vocal"],
  ["lo-fi", "polished crisp"],
];

const VOCAL_HINTS = [
  "vocal",
  "vocals",
  "singer",
  "rap",
  "baritone",
  "soprano",
  "tenor",
  "breathy",
  "belted",
  "whisper",
  "delivery",
  "close-mic",
];

const PRODUCTION_HINTS = ["bpm", "mix", "reverb", "compression", "lo-fi", "studio", "polished", "analog", "warm"];

/**
 * @param {string} styleLine
 * @param {string} [lyrics]
 * @param {{ usingSunoVoice?: boolean }} [opts]
 */
export function analyzeSunoPromptQuality(styleLine, lyrics = "", opts = {}) {
  const style = String(styleLine || "").trim();
  const lyr = String(lyrics || "").trim();
  const issues = [];
  const strengths = [];
  let score = 50;

  if (!style) {
    issues.push({ severity: "high", message: "Style line is empty — Suno will guess genre and mood." });
    score -= 30;
  } else {
    score += 10;
    if (style.length > SUNO_STYLE_CHAR_CAP) {
      issues.push({ severity: "high", message: `Style exceeds ${SUNO_STYLE_CHAR_CAP} chars — will truncate.` });
      score -= 15;
    } else if (style.length >= 80) {
      strengths.push("Style line has enough detail for consistent output.");
      score += 10;
    }

    const lower = style.toLowerCase();
    const tags = style.split(",").map((t) => t.trim()).filter(Boolean);
    if (tags.length > 14) {
      issues.push({ severity: "medium", message: "Too many style tags — Suno may ignore some." });
      score -= 8;
    }

    for (const [a, b] of CONFLICT_PAIRS) {
      if (lower.includes(a) && lower.includes(b)) {
        issues.push({ severity: "high", message: `Conflicting tags: "${a}" vs "${b}".` });
        score -= 12;
      }
    }

    if (VOCAL_HINTS.some((h) => lower.includes(h))) {
      strengths.push("Vocal direction present.");
      score += 8;
    } else if (!opts.usingSunoVoice) {
      issues.push({ severity: "medium", message: "No vocal direction — add delivery or register." });
      score -= 6;
    }

    if (PRODUCTION_HINTS.some((h) => lower.includes(h))) {
      strengths.push("Production cues included.");
      score += 6;
    }

    if (/\d+\s*bpm/i.test(style)) {
      strengths.push("BPM anchor present.");
      score += 5;
    }

    if (opts.usingSunoVoice && /\b(male vocal|female vocal|male singer|female singer)\b/i.test(style)) {
      issues.push({ severity: "low", message: "Drop gender tags when using Suno Voices — save chars for production." });
      score -= 3;
    }
  }

  if (lyr) {
    if (lyr.length > SUNO_LYRICS_CHAR_TYPICAL_MAX) {
      issues.push({ severity: "medium", message: `Lyrics may truncate near ${SUNO_LYRICS_CHAR_TYPICAL_MAX} chars.` });
      score -= 5;
    }
    if (/\[(Verse|Chorus|Bridge|Intro|Outro)/i.test(lyr)) {
      strengths.push("Structure metatags in lyrics.");
      score += 8;
    } else if (!/^\[Instrumental\]/i.test(lyr)) {
      issues.push({ severity: "medium", message: "Add [Verse] / [Chorus] metatags for arrangement control." });
      score -= 5;
    }
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    score,
    grade: score >= 85 ? "excellent" : score >= 70 ? "good" : score >= 50 ? "fair" : "weak",
    issues,
    strengths,
    suggestions: buildSuggestions(issues),
  };
}

/**
 * @param {object[]} issues
 */
function buildSuggestions(issues) {
  const out = [];
  for (const issue of issues) {
    if (issue.message.includes("empty")) out.push("Add genre, BPM, mood, vocal delivery, and 2–3 instruments.");
    if (issue.message.includes("Conflicting")) out.push("Remove one side of the conflict or split across style vs lyrics metatags.");
    if (issue.message.includes("vocal direction")) out.push("Try: polished lead vocal, emotive phrasing, studio close-mic");
    if (issue.message.includes("metatags")) out.push("Use [Verse], [Chorus], [Bridge] at section starts in lyrics.");
  }
  return [...new Set(out)].slice(0, 4);
}
