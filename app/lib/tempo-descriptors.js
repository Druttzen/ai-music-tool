/**
 * v5.5 guidance: pair numeric BPM with an evocative tempo adjective.
 */

/** @param {number} bpm */
export function tempoDescriptorForBpm(bpm) {
  const n = Number(bpm);
  if (!Number.isFinite(n) || n <= 0) return "";
  if (n < 70) return "very slow and deliberate";
  if (n < 90) return "slow and relaxed";
  if (n < 108) return "mid-tempo and steady";
  if (n < 125) return "driving and upbeat";
  if (n < 145) return "energetic and propulsive";
  if (n < 170) return "fast and urgent";
  return "very fast and intense";
}

/**
 * @param {string|number} tempo - e.g. "128 BPM" or 128
 * @returns {string} e.g. "128 BPM, driving and upbeat"
 */
export function formatTempoWithDescriptor(tempo) {
  const raw = String(tempo || "").trim();
  const match = raw.match(/(\d{2,3})/);
  if (!match) return raw;
  const bpm = Number(match[1]);
  const descriptor = tempoDescriptorForBpm(bpm);
  return descriptor ? `${bpm} BPM, ${descriptor}` : `${bpm} BPM`;
}

/**
 * @param {string} tempo
 * @returns {boolean}
 */
export function tempoAlreadyHasDescriptor(tempo) {
  const lower = String(tempo || "").toLowerCase();
  return /,\s*(slow|fast|steady|driving|relaxed|deliberate|upbeat|urgent|mid-tempo|energetic|propulsive|intense)/i.test(
    lower,
  );
}
