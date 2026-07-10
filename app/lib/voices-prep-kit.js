/**
 * Suno 5.5 Voices prep kit — sample QA and verification guidance.
 */

/**
 * @param {object} analysis — voice-character-analyzer output
 * @param {number} [durationSec]
 */
export function buildVoicesPrepKit(analysis, durationSec = 0) {
  const duration = Number(durationSec) || 0;
  const range = Number(analysis?.pitchRangeSemitones) || 0;
  const median = Number(analysis?.pitchMedianHz) || 0;
  const checks = [];

  if (duration < 15) {
    checks.push({ ok: false, label: "Sample length", detail: "Need at least 15s of vocal audio for Suno Voices." });
  } else if (duration > 240) {
    checks.push({ ok: true, label: "Sample length", detail: "Long sample — pick best 2 minutes in Suno upload UI." });
  } else {
    checks.push({ ok: true, label: "Sample length", detail: `${Math.round(duration)}s — within Suno Voices range.` });
  }

  if (range < 8) {
    checks.push({ ok: false, label: "Pitch range", detail: "Range narrow — include low and high phrases for better voice capture." });
  } else {
    checks.push({ ok: true, label: "Pitch range", detail: `${range} semitones — good expressive coverage.` });
  }

  if (median > 0) {
    checks.push({ ok: true, label: "Register", detail: `${Math.round(median)} Hz median — ${analysis?.characterLabel || "mapped register"}.` });
  }

  const audioInfluence =
    range >= 12 && duration >= 30 ? 80 : range >= 8 ? 65 : 45;

  return {
    checks,
    ready: checks.every((c) => c.ok),
    audioInfluencePct: audioInfluence,
    verificationTip: "Speak or sing the random verification phrase Suno shows — singing often improves capture.",
    styleHints: [
      analysis?.textureTags?.[0] || "expressive lead vocal",
      analysis?.deliveryPace || "emotive phrasing",
      analysis?.toneFocus ? `${analysis.toneFocus} tone` : "studio close-mic",
    ].filter(Boolean),
    dropGenderInStyle: true,
  };
}
