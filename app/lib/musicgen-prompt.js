/**
 * Build a MusicGen text prompt from project + analyzer context.
 */

import { isGuidedPasteBlank } from "./suno-guided-workflow";

function normalizeToken(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

/**
 * @param {object} input
 * @param {string} [input.customPrompt]
 * @param {string[]} [input.selectedGenres]
 * @param {string[]} [input.selectedSounds]
 * @param {string[]} [input.selectedRhythms]
 * @param {string} [input.tempo]
 * @param {string} [input.idea]
 * @param {string} [input.moodWords]
 * @param {object} [input.audioAnalysis]
 */
export function buildMusicGenPrompt(input = {}) {
  const custom = normalizeToken(input.customPrompt);
  if (custom) return custom.slice(0, 480);

  if (
    !input.audioAnalysis &&
    isGuidedPasteBlank({
      selectedGenres: input.selectedGenres,
      selectedSounds: input.selectedSounds,
      selectedRhythms: input.selectedRhythms,
      tempo: input.tempo,
      idea: input.idea,
      moodWords: input.moodWords,
      vocal: "",
    })
  ) {
    return "";
  }

  const parts = [];
  const genres = (input.selectedGenres || []).slice(0, 2);
  if (genres.length) parts.push(genres.join(" + "));
  const tempo = normalizeToken(input.tempo);
  if (tempo) parts.push(tempo.replace(/\s*BPM/i, " bpm"));
  const mood = normalizeToken(input.moodWords);
  if (mood) parts.push(mood.split(/,\s*/).slice(0, 3).join(", "));
  const sounds = (input.selectedSounds || []).slice(0, 3);
  if (sounds.length) parts.push(sounds.join(", "));
  const rhythms = (input.selectedRhythms || []).slice(0, 2);
  if (rhythms.length) parts.push(rhythms.join(", "));
  const idea = normalizeToken(input.idea);
  if (idea) parts.push(idea.slice(0, 120));

  const analysis = input.audioAnalysis;
  if (analysis?.trackSummary) {
    parts.push(normalizeToken(analysis.trackSummary).slice(0, 140));
  } else if (analysis?.estimatedBpm && analysis?.estimatedKey) {
    parts.push(`${analysis.estimatedBpm}, ${analysis.estimatedKey}`);
  }

  const joined = parts.filter(Boolean).join(", ");
  return (joined || "instrumental electronic music, steady groove, modern production").slice(0, 480);
}
