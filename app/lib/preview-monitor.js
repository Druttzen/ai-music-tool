/**
 * Preview-only monitoring utilities: A/B gain match, spectrum, headphone EQ.
 */

/**
 * Gain linear to match reference integrated LUFS to program LUFS.
 * @param {number} programLufs
 * @param {number} referenceLufs
 */
export function gainToMatchLufs(programLufs, referenceLufs) {
  if (!Number.isFinite(programLufs) || !Number.isFinite(referenceLufs)) return 1;
  return Math.pow(10, (programLufs - referenceLufs) / 20);
}

export const PREVIEW_EQ_STORAGE_KEY = "aimc-preview-headphone-eq";

/** @typedef {{ enabled: boolean, bands: { freq: number, gain: number, q: number }[] }} PreviewEqState */

/** @returns {PreviewEqState} */
export function defaultPreviewEqState() {
  return {
    enabled: false,
    bands: [
      { freq: 80, gain: 0, q: 0.7 },
      { freq: 250, gain: 0, q: 0.9 },
      { freq: 1000, gain: 0, q: 0.9 },
      { freq: 4000, gain: 0, q: 0.9 },
      { freq: 10000, gain: 0, q: 0.7 },
    ],
  };
}

/** @returns {PreviewEqState} */
export function loadPreviewEqState() {
  if (typeof window === "undefined") return defaultPreviewEqState();
  try {
    const raw = window.localStorage.getItem(PREVIEW_EQ_STORAGE_KEY);
    if (!raw) return defaultPreviewEqState();
    const parsed = JSON.parse(raw);
    const base = defaultPreviewEqState();
    return {
      enabled: Boolean(parsed?.enabled),
      bands: Array.isArray(parsed?.bands) && parsed.bands.length
        ? parsed.bands.map((b, i) => ({
            freq: Number(b.freq) || base.bands[i]?.freq || 1000,
            gain: Number(b.gain) || 0,
            q: Number(b.q) || 0.9,
          }))
        : base.bands,
    };
  } catch {
    return defaultPreviewEqState();
  }
}

/** @param {PreviewEqState} state */
export function savePreviewEqState(state) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREVIEW_EQ_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota */
  }
}
