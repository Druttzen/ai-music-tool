/**
 * Build lyric scaffolds timed to an uploaded instrumental reference track.
 */

import { formatTime } from "./audio-analyzer";

/**
 * @param {object|null} analysis
 * @param {string} [vocal]
 */
export function isLikelyInstrumentalTrack(analysis, vocal = "Instrumental") {
  if (!analysis) return false;
  const detected = String(analysis.vocals || "").toLowerCase();
  if (detected.includes("instrumental")) return true;
  if (vocal === "Instrumental" && !detected.includes("vocals likely")) return true;
  return false;
}

/**
 * @param {object|null} analysis
 */
export function suggestVocalRoleFromAnalysis(analysis) {
  const energy = analysis?.energy ?? 50;
  const aggression = analysis?.aggression ?? 50;
  if (aggression > 70) return "Rave Chant";
  if (energy > 78) return "Male Lead";
  if (energy < 38) return "Female Lead";
  return "Male Lead";
}

/**
 * @param {object|null} analysis
 */
export function suggestLyricStyleFromAnalysis(analysis) {
  const moods = (analysis?.suggestedMoods || []).join(" ").toLowerCase();
  if (moods.includes("dark") || (analysis?.darkness ?? 0) > 60) return "Dark poetic";
  if (moods.includes("aggressive") || (analysis?.aggression ?? 0) > 65) return "Aggressive hype";
  if ((analysis?.energy ?? 0) > 70) return "Club chant";
  return "Emotional cinematic";
}

/**
 * @param {object|null} analysis
 */
export function buildLyricThemeFromAnalysis(analysis) {
  const summary = String(analysis?.trackSummary || "").replace(/\s+/g, " ").trim();
  if (summary) return summary.slice(0, 180);

  const genres = [
    ...(analysis?.suggestedGenres || []),
    ...(analysis?.suggestedSubgenres || []),
  ]
    .slice(0, 2)
    .join(" + ");
  const moods = (analysis?.suggestedMoods || []).slice(0, 3).join(", ");
  return `Lyrics for this ${genres || "instrumental"} bed — ${moods || "match groove and energy"}`.slice(
    0,
    180,
  );
}

/**
 * @param {object|null} analysis
 */
export function inferStructureFromTrack(analysis) {
  const duration = Number(analysis?.duration) || 180;
  if (duration < 75) return "intro → verse → chorus → outro";
  if (duration < 150) return "intro → verse → pre-chorus → chorus → verse → chorus → outro";
  return "intro → verse → build → drop → breakdown → chorus → final drop → outro";
}

/**
 * Remove instrumental-only safety lines when adding sung lyrics.
 * @param {string} rulesText
 */
export function stripInstrumentalOnlyRules(rulesText) {
  return String(rulesText || "")
    .split("\n")
    .filter((line) => {
      const l = line.toLowerCase().trim();
      if (!l) return true;
      if (l.includes("no vocal chops")) return false;
      if (l.includes("no mumbled")) return false;
      if (l.includes("instrumental only")) return false;
      if (/^no vocals\b/.test(l)) return false;
      return true;
    })
    .join("\n")
    .trim();
}

/**
 * @param {number} startSec
 * @param {number} endSec
 * @param {string} label
 */
function sectionCue(startSec, endSec, label) {
  return `[${label} — ${formatTime(startSec)}–${formatTime(endSec)} | lock to bed]`;
}

/**
 * Suno-ready lyric scaffold with section tags aligned to track timing.
 * @param {object} analysis
 * @param {{ theme?: string }} [opts]
 */
export function buildInstrumentalLyricsScaffold(analysis, opts = {}) {
  const duration = Math.max(8, Number(analysis?.duration) || 180);
  const bpm = Number(analysis?.bpm) || 120;
  const theme = opts.theme || buildLyricThemeFromAnalysis(analysis);
  const fileName = analysis?.fileName || "track";
  const hiStart = Math.max(0, Number(analysis?.highlightStart) || 0);
  const hiEnd = Math.min(duration, Number(analysis?.highlightEnd) || duration);
  const hiLabel = analysis?.highlightLabel || "highlight";

  const introEnd = Math.min(20, duration * 0.1);
  const verse1End = introEnd + Math.min(36, duration * 0.22);
  const preEnd = verse1End + Math.min(18, duration * 0.1);
  const chorusStart =
    hiStart >= introEnd && hiStart <= duration * 0.88 ? hiStart : preEnd;
  const chorusEnd = Math.min(duration, Math.max(chorusStart + 28, hiEnd));

  const lines = [
    `[Meta: Lyrics for uploaded instrumental "${fileName}" — ${formatTime(duration)} @ ${bpm} BPM]`,
    "",
    sectionCue(0, introEnd, "Intro"),
    "(wait for the bed — enter on the groove, not before)",
    "",
    sectionCue(introEnd, verse1End, "Verse 1"),
    theme,
    "(short syllables — leave pockets for kick and bass)",
    "",
  ];

  if (duration > 85) {
    lines.push(sectionCue(verse1End, preEnd, "Pre-Chorus"));
    lines.push("(tighten rhythm — one breath per bar)");
    lines.push("");
  }

  lines.push(sectionCue(chorusStart, chorusEnd, "Chorus"));
  lines.push(`[Hook — ${hiLabel} peak @ ${formatTime(chorusStart)}]`);
  lines.push("(repeatable hook — same rhythm as the drop)");
  lines.push("");

  if (duration > 110) {
    const v2End = Math.min(duration * 0.72, chorusEnd + 40);
    lines.push(sectionCue(chorusEnd, v2End, "Verse 2"));
    lines.push("(new image — same pulse as verse 1)");
    lines.push("");
    lines.push(sectionCue(v2End, Math.min(duration * 0.92, duration - 8), "Final Chorus"));
    lines.push("(hook + short ad-libs in parentheses)");
    lines.push("");
  }

  lines.push(sectionCue(Math.max(0, duration - 10), duration, "Outro"));
  lines.push("(trail with the instrumental — held vowel or hum)");

  return lines.join("\n");
}

/** 0-based guided step index for the Lyric direction step. */
export function getGuidedLyricsStepIndex() {
  return 5;
}
