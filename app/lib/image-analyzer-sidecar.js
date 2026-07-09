/**
 * Merge optional BLIP caption results from the vision sidecar into pixel image analysis.
 */

import { uniq } from "./music-helpers";
import { genreOptions, rhythmOptions, soundOptions } from "./suno-music-styles";

export const VISION_CAPTION_MODEL_ID = "Salesforce/blip-image-captioning-base";

/**
 * @param {string} text
 * @param {string[]} catalog
 * @param {number} [max]
 */
function catalogHitsFromText(text, catalog, max = 4) {
  const lower = String(text || "").toLowerCase();
  if (!lower) return [];
  const hits = [];
  for (const item of catalog) {
    const lc = item.toLowerCase();
    const words = lc.split(/[\s-/]+/).filter((w) => w.length > 3);
    const match =
      lower.includes(lc) || words.some((word) => lower.includes(word));
    if (match && !hits.includes(item)) {
      hits.push(item);
      if (hits.length >= max) break;
    }
  }
  return hits;
}

/**
 * @param {string|null|undefined} caption
 */
export function mapImageCaptionToSuno(caption) {
  const text = String(caption || "").trim();
  if (!text) {
    return { suggestedGenres: [], suggestedSounds: [], suggestedRhythms: [] };
  }
  return {
    suggestedGenres: catalogHitsFromText(text, genreOptions, 4),
    suggestedSounds: catalogHitsFromText(text, soundOptions, 4),
    suggestedRhythms: catalogHitsFromText(text, rhythmOptions, 3),
  };
}

/**
 * @param {object} pixelReport
 * @param {{ caption?: string|null, caption_model?: string|null, device?: string }} sidecar
 */
export function mergeSidecarImageAnalysis(pixelReport, sidecar) {
  if (!pixelReport) return pixelReport;
  const caption = String(sidecar?.caption || "").trim();
  if (!caption) {
    return { ...pixelReport, analysisEngine: pixelReport.analysisEngine || "pixel" };
  }

  const captionTags = mapImageCaptionToSuno(caption);
  const suggestedGenres = uniq([
    ...(captionTags.suggestedGenres || []),
    ...(pixelReport.suggestedGenres || []),
  ]);
  const suggestedSounds = uniq([
    ...(captionTags.suggestedSounds || []),
    ...(pixelReport.suggestedSounds || []),
  ]);
  const suggestedRhythms = uniq([
    ...(captionTags.suggestedRhythms || []),
    ...(pixelReport.suggestedRhythms || []),
  ]);

  const captionLine = `Scene caption (BLIP): ${caption}`;
  const summary = pixelReport.summary?.includes(caption)
    ? pixelReport.summary
    : `${pixelReport.summary}\n${captionLine}`;

  return {
    ...pixelReport,
    caption,
    captionModel: sidecar?.caption_model || VISION_CAPTION_MODEL_ID,
    sidecarDevice: sidecar?.device || null,
    suggestedGenres,
    suggestedSounds,
    suggestedRhythms,
    summary,
    analysisEngine: "pixel+blip",
  };
}
