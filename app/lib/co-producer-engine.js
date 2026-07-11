import { uniq } from "./music-helpers";
import { scoreAdvisoryLines, formatScoreSummary } from "./track-scoring";

/**
 * @param {object|null|undefined} audioAnalysis
 */
export function formatMusicGenSketchBrief(audioAnalysis) {
  if (!audioAnalysis || audioAnalysis.sourceEngine !== "musicgen") return null;
  return {
    prompt: audioAnalysis.musicGenPrompt || "",
    bpm: audioAnalysis.estimatedBpm || "",
    key: audioAnalysis.estimatedKey || "",
    summary: audioAnalysis.trackSummary || "",
    model: audioAnalysis.musicGenModel || "",
    mode: audioAnalysis.musicGenMode || "",
    highlightMelody: !!audioAnalysis.musicGenHighlightMelody,
  };
}

/** @param {string} output @param {ReturnType<typeof formatMusicGenSketchBrief>} sketch */
export function appendMusicGenSketchToReport(output, sketch) {
  if (!sketch) return output;
  const modeNote =
    sketch.mode === "melody"
      ? sketch.highlightMelody
        ? " · highlight melody"
        : " · melody-conditioned"
      : "";
  const line = `Local MusicGen sketch${modeNote}: “${(sketch.prompt || sketch.summary || "preview").slice(0, 120)}” (${sketch.bpm || "?"}, ${sketch.key || "?"}). Treat AUDIO/MG rule lines as groove reference before Suno.`;
  if (output.includes("Local MusicGen sketch")) return output;
  return `${output.trim()}\n\n${line}`;
}

/**
 * One-click Co-Producer mood/style tweaks from the guided workspace.
 * @param {string} action
 * @returns {Record<string, unknown>} patch for project reducer
 */
export function buildCoProducerQuickTweakPatch(action) {
  /** @type {Record<string, unknown>} */
  const patch = {};

  if (action === "Make darker") {
    patch.mood = (m) => ({ ...m, darkness: Math.min(100, m.darkness + 15) });
  }
  if (action === "More aggressive") {
    patch.mood = (m) => ({
      ...m,
      aggression: Math.min(100, m.aggression + 15),
      energy: Math.min(100, m.energy + 10),
    });
  }
  if (action === "More minimal") {
    patch.mood = (m) => ({ ...m, complexity: Math.max(0, m.complexity - 20) });
  }
  if (action === "More cinematic") {
    patch.selectedGenres = (g) => uniq([...g, "Cinematic"]);
    patch.selectedSounds = (s) => uniq([...s, "Orchestral strings", "Big drums"]);
    patch.mood = (m) => ({
      ...m,
      space: Math.min(100, m.space + 15),
      emotion: Math.min(100, m.emotion + 10),
    });
  }
  if (action === "More club") {
    patch.selectedRhythms = (r) => uniq([...r, "4/4"]);
    patch.selectedSounds = (s) => uniq([...s, "Heavy sub bass", "Big drums"]);
    patch.mood = (m) => ({ ...m, energy: Math.min(100, m.energy + 15) });
  }

  return patch;
}

/**
 * Heuristic Co-Producer advisory report + optional auto-fix patch.
 * @param {object} input
 * @returns {{ output: string, patch: Record<string, unknown> }}
 */
export function buildCoProducerAdvisoryReport({
  selectedGenres,
  selectedSounds,
  selectedRhythms,
  mood,
  moodWords,
  tempo,
  vocal,
  lyricTheme,
  promptIntensity,
  mode,
  musicGenAvailable = false,
  audioAnalysis = null,
  scores = null,
}) {
  const suggestions = [];
  const fixesToApply = [];
  const musicGenSketch = formatMusicGenSketchBrief(audioAnalysis);

  if (selectedGenres.length > 3) {
    suggestions.push(
      "Too many genres can weaken identity. Keep one main genre and one secondary influence.",
    );
  }
  if (selectedSounds.length > 8) {
    suggestions.push(
      "Sound list is very long. Prioritize bass, drums, atmosphere, and one signature texture.",
    );
  }
  if (
    mood.energy > 75 &&
    !selectedRhythms.includes("4/4") &&
    !selectedRhythms.includes("Breakbeat")
  ) {
    suggestions.push("High energy needs a stronger rhythm anchor: add 4/4 or Breakbeat.");
  }
  if (mood.darkness > 65 && !selectedSounds.includes("Dark pads")) {
    fixesToApply.push("Dark pads");
  }
  if (mood.aggression > 65 && !selectedSounds.includes("Distorted bass")) {
    fixesToApply.push("Distorted bass");
  }
  if (mood.space > 65 && !selectedSounds.includes("Dub delays")) {
    fixesToApply.push("Dub delays");
  }
  if (vocal !== "Instrumental" && lyricTheme.length < 12) {
    suggestions.push(
      "Lyric theme is short. Add clearer story, emotion, or repeated phrase direction.",
    );
  }
  if (promptIntensity > 75 && mode === "Control") {
    suggestions.push("Prompt intensity is high but mode is Control. Switch to Hybrid or lower intensity.");
  }
  if (musicGenAvailable && selectedGenres.length < 2 && !musicGenSketch) {
    suggestions.push(
      "Genre identity is thin — try MusicGen sketch (Co-Producer buttons or Polish analyzers) for a local reference loop before Suno.",
    );
  }
  if (musicGenSketch) {
    suggestions.push(
      `MusicGen sketch loaded (${musicGenSketch.bpm || "?"}, ${musicGenSketch.key || "?"}). Merge is in AUDIO/MG — align Suno tempo and genre anchors to the sketch.`,
    );
  }

  suggestions.push(...scoreAdvisoryLines(scores));

  const scoreLine = formatScoreSummary(scores);

  const moodDirective =
    mood.darkness > 65
      ? "Lean into dark imagery, low-end pressure, shadowy atmosphere, and mechanical tension."
      : "Keep the mood brighter, clearer, and more open.";

  const output = appendMusicGenSketchToReport(
    `CO-PRODUCER AI REPORT
Main identity: ${selectedGenres[0] || "Electronic"} with ${selectedGenres[1] || "modern"} influence.
Best tempo target: ${tempo}
Mood translation: ${moodWords}
Sound focus: ${selectedSounds.slice(0, 5).join(", ") || "bass, drums, atmosphere"}
${scoreLine ? `Track scoring: ${scoreLine}` : ""}

Recommended direction:
${moodDirective}

Fixes:
${suggestions.length ? suggestions.map((x, i) => `${i + 1}. ${x}`).join("\n") : "Prompt is balanced. Generate 3 variations and score the strongest one."}

Auto-added sound ideas:
${fixesToApply.length ? fixesToApply.join(", ") : "No extra sound modules needed."}`,
    musicGenSketch,
  );

  /** @type {Record<string, unknown>} */
  const patch = {};
  if (fixesToApply.length) {
    patch.selectedSounds = (s) => uniq([...s, ...fixesToApply]);
  }
  if (mood.energy > 75) {
    patch.selectedRhythms = (r) => uniq([...r, "4/4"]);
  }
  if (promptIntensity > 75 && mode === "Control") {
    patch.mode = "Hybrid";
  }

  return { output, patch };
}
