/**
 * Portable music project exchange.
 *
 * The wire values remain compatible with existing AI Creator importers, while
 * this module deliberately contains no knowledge of their UI or runtime.
 */

export const MUSIC_EXCHANGE_SOURCE = "ai-music-creator";
export const MUSIC_EXCHANGE_CONTRACT = "ai-music-exchange-v1";

export const MUSIC_EXCHANGE_INTENTS = {
  PROJECT_ONLY: "project-only",
  TRACK: "music-video-track",
  TRACK_WITH_ARTWORK: "music-video-path-e",
};

/** @param {{ audioAnalysis?: unknown, imageAnalysis?: unknown }} params */
export function resolveMusicExchangeIntent({ audioAnalysis, imageAnalysis }) {
  if (audioAnalysis && imageAnalysis) return MUSIC_EXCHANGE_INTENTS.TRACK_WITH_ARTWORK;
  if (audioAnalysis) return MUSIC_EXCHANGE_INTENTS.TRACK;
  return MUSIC_EXCHANGE_INTENTS.PROJECT_ONLY;
}

/** @param {Record<string, any>} [params] */
export function buildMusicProjectExchangeBlock(params = {}) {
  const intent = params.intent || resolveMusicExchangeIntent(params);
  return {
    source: MUSIC_EXCHANGE_SOURCE,
    contract: MUSIC_EXCHANGE_CONTRACT,
    intent,
    exportedAt: new Date().toISOString(),
    musicAppVersion: params.musicAppVersion || params.appVersion || "",
    audioAnalysis: params.audioAnalysis || null,
    imageAnalysis: params.imageAnalysis || null,
    audioSidecarName: params.audioSidecarName || null,
    sunoPasteStyle: params.sunoPasteStyle || "",
    sunoPasteLyrics: params.sunoPasteLyrics || "",
  };
}

/** @param {string} idea */
export function slugifyMusicExchangeBaseName(idea) {
  const slug = String(idea || "music-project")
    .trim()
    .slice(0, 48)
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "music-project";
}

/** @param {string} json @param {string} filename */
export function downloadTextFile(json, filename) {
  const blob = new Blob([json], { type: "application/json" });
  downloadBlobFile(blob, filename);
}

/** @param {Blob} blob @param {string} filename */
export function downloadBlobFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
