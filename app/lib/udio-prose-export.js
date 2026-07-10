/**
 * Udio prose export — scene-description format (not comma style tags).
 */

/**
 * @param {object} dna — Style-DNA object
 * @param {object} [opts]
 */
export function buildUdioProsePrompt(dna, opts = {}) {
  const genres = (dna?.genres || []).slice(0, 2).join(" and ") || "contemporary";
  const tempo = String(dna?.tempo || "moderate tempo").replace(/\s*BPM/i, " BPM");
  const key = dna?.estimatedKey ? ` in ${dna.estimatedKey}` : "";
  const moods = (dna?.moodWords || dna?.moods || []).slice(0, 3).join(", ") || "emotive";
  const sounds = (dna?.sounds || []).slice(0, 4).join(", ") || "layered instrumentation";
  const vocal = dna?.vocalRole && !String(dna.vocalRole).toLowerCase().includes("instrumental")
    ? `${dna.vocalRole} vocal performance`
    : "instrumental arrangement";

  const scene = opts.scene || `A ${moods} ${genres} piece at ${tempo}${key}.`;
  const body = [
    scene,
    `The arrangement features ${sounds}, with ${vocal}.`,
    `Production should feel ${dna?.featureSummary || "genre-faithful"} with clear dynamics and a finished mix perspective.`,
    opts.reference ? `Stylistic reference: ${opts.reference} — match groove and mood, not identity.` : "",
  ].filter(Boolean);

  return body.join(" ").slice(0, 1200);
}
