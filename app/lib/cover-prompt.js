/**
 * Build a FLUX-friendly album cover prompt from Suno Style / analyzer tokens.
 */

const COVER_SUFFIX = "album cover art, square composition, no typography, no letters, no watermark";

/**
 * @param {string} styleOrPrompt
 * @param {{ maxLen?: number }} [options]
 */
export function buildCoverPromptFromStyle(styleOrPrompt, options = {}) {
  const maxLen = options.maxLen ?? 360;
  let core = String(styleOrPrompt || "")
    .replace(/\s+/g, " ")
    .replace(/\b(IMAGE|AUDIO|REF|NO-GO|CAP|MS|G|CH|MG):/gi, " ")
    .replace(/[│|]+/g, ",")
    .replace(/\s+,/g, ",")
    .replace(/,+/g, ", ")
    .trim();

  if (!core) {
    core = "abstract music artwork, atmospheric, cinematic lighting";
  }

  const combined = `${core}, ${COVER_SUFFIX}`;
  if (combined.length <= maxLen) return combined;

  const budget = Math.max(40, maxLen - COVER_SUFFIX.length - 2);
  let trimmed = core.slice(0, budget);
  const comma = trimmed.lastIndexOf(",");
  if (comma > budget * 0.45) trimmed = trimmed.slice(0, comma);
  return `${trimmed.trim()}, ${COVER_SUFFIX}`;
}

/**
 * Prefer paste Style, then guided Style slice, then analyzer style previews.
 * @param {{ sunoPasteStyle?: string, sunoFieldStyle?: string, imageStylePreview?: string, audioStylePreview?: string, idea?: string }} sources
 */
export function resolveCoverPromptSource(sources = {}) {
  const candidates = [
    sources.sunoPasteStyle,
    sources.sunoFieldStyle,
    sources.imageStylePreview,
    sources.audioStylePreview,
    sources.idea,
  ];
  for (const c of candidates) {
    const t = String(c || "").trim();
    if (t) return t;
  }
  return "";
}
