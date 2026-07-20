/**
 * Merge optional BLIP caption + CLIP tag results from the vision sidecar into pixel image analysis.
 */

import { uniq } from "./music-helpers";
import { genreOptions, rhythmOptions, soundOptions } from "./suno-music-styles";
import { hintsFromClipLabel } from "./image-to-suno-style";

export const VISION_CAPTION_MODEL_ID = "Salesforce/blip-image-captioning-base";
export const VISION_CLIP_MODEL_ID = "openai/clip-vit-base-patch32";

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
 * @param {{ label: string, score: number }[]|null|undefined} clipTags
 */
export function mapClipTagsToSuno(clipTags) {
  if (!Array.isArray(clipTags) || !clipTags.length) {
    return { suggestedGenres: [], suggestedSounds: [], suggestedRhythms: [] };
  }
  const fromHints = { genres: [], sounds: [], rhythms: [] };
  for (const tag of clipTags) {
    const h = hintsFromClipLabel(tag.label);
    fromHints.genres.push(...h.genres);
    fromHints.sounds.push(...h.sounds);
    fromHints.rhythms.push(...h.rhythms);
  }
  const text = clipTags.map((tag) => tag.label).join(", ");
  const fromCatalog = mapImageCaptionToSuno(text);
  return {
    suggestedGenres: uniq([...fromHints.genres, ...fromCatalog.suggestedGenres]),
    suggestedSounds: uniq([...fromHints.sounds, ...fromCatalog.suggestedSounds]),
    suggestedRhythms: uniq([...fromHints.rhythms, ...fromCatalog.suggestedRhythms]),
  };
}

/**
 * @param {object} pixelReport
 * @param {{ caption?: string|null, caption_model?: string|null, clip_tags?: Array<{label:string,score:number}>|null, clip_model?: string|null, device?: string }} sidecar
 */
export function mergeSidecarImageAnalysis(pixelReport, sidecar) {
  if (!pixelReport) return pixelReport;
  const caption = String(sidecar?.caption || "").trim();
  const clipTags = Array.isArray(sidecar?.clip_tags) ? sidecar.clip_tags : [];
  if (!caption && !clipTags.length) {
    return { ...pixelReport, analysisEngine: pixelReport.analysisEngine || "pixel" };
  }

  const captionTags = mapImageCaptionToSuno(caption);
  const clipCatalogTags = mapClipTagsToSuno(clipTags);
  const suggestedGenres = uniq([
    ...(clipCatalogTags.suggestedGenres || []),
    ...(captionTags.suggestedGenres || []),
    ...(pixelReport.suggestedGenres || []),
  ]);
  const suggestedSounds = uniq([
    ...(clipCatalogTags.suggestedSounds || []),
    ...(captionTags.suggestedSounds || []),
    ...(pixelReport.suggestedSounds || []),
  ]);
  const suggestedRhythms = uniq([
    ...(clipCatalogTags.suggestedRhythms || []),
    ...(captionTags.suggestedRhythms || []),
    ...(pixelReport.suggestedRhythms || []),
  ]);

  const summaryParts = [pixelReport.summary];
  if (caption) summaryParts.push(`Scene caption (BLIP): ${caption}`);
  if (clipTags.length) {
    const top = clipTags
      .slice(0, 3)
      .map((tag) => tag.label)
      .join(", ");
    summaryParts.push(`Visual tags (CLIP): ${top}`);
  }
  const summary = summaryParts.filter(Boolean).join("\n");

  const engines = ["pixel"];
  if (caption) engines.push("blip");
  if (clipTags.length) engines.push("clip");

  return {
    ...pixelReport,
    caption: caption || pixelReport.caption || null,
    captionModel: sidecar?.caption_model || (caption ? VISION_CAPTION_MODEL_ID : null),
    clipTags,
    clipModel: sidecar?.clip_model || (clipTags.length ? VISION_CLIP_MODEL_ID : null),
    sidecarDevice: sidecar?.device || null,
    suggestedGenres,
    suggestedSounds,
    suggestedRhythms,
    summary,
    analysisEngine: engines.join("+"),
  };
}
