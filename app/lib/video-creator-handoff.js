/**
 * Export bundle for AI Video Creator (handoff v2).
 */

export const HANDOFF_SOURCE_MUSIC = "ai-music-creator";

export const HANDOFF_INTENTS = {
  MUSIC_VIDEO_PATH_E: "music-video-path-e",
  MUSIC_VIDEO_TRACK: "music-video-track",
  PROJECT_ONLY: "project-only",
};

export const MV_DURATION_MODES = {
  FULL: "full",
  HIGHLIGHT: "highlight",
};

/**
 * @param {object} params
 */
export function resolveHandoffIntent({ audioAnalysis, imageAnalysis }) {
  if (audioAnalysis && imageAnalysis) return HANDOFF_INTENTS.MUSIC_VIDEO_PATH_E;
  if (audioAnalysis) return HANDOFF_INTENTS.MUSIC_VIDEO_TRACK;
  return HANDOFF_INTENTS.PROJECT_ONLY;
}

/**
 * @param {object} params
 */
export function buildVideoCreatorDirectorSettings({ audioAnalysis, imageAnalysis } = {}) {
  const durationSec = Math.min(
    480,
    Math.max(5, Math.round(Number(audioAnalysis?.durationSec ?? audioAnalysis?.duration ?? 30) || 30)),
  );
  return {
    renderBackend: "local-python",
    localRenderEngine: "diffusers-wan",
    durationSeconds: String(durationSec),
    useI2vWhenImage: Boolean(imageAnalysis),
  };
}

/**
 * @param {object} params
 */
export function buildVideoCreatorHandoffBlock(params = {}) {
  const intent = params.intent || resolveHandoffIntent(params);
  return {
    source: HANDOFF_SOURCE_MUSIC,
    intent,
    exportedAt: new Date().toISOString(),
    musicAppVersion: params.musicAppVersion || params.appVersion || "",
    audioAnalysis: params.audioAnalysis || null,
    imageAnalysis: params.imageAnalysis || null,
    audioSidecarName: params.audioSidecarName || null,
    sunoPasteStyle: params.sunoPasteStyle || "",
    sunoPasteLyrics: params.sunoPasteLyrics || "",
    durationMode: params.durationMode || MV_DURATION_MODES.FULL,
  };
}

/**
 * @param {string} idea
 */
export function slugifyHandoffBaseName(idea) {
  const slug = String(idea || "music-video")
    .trim()
    .slice(0, 48)
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "music-video";
}

/**
 * @param {string} json
 * @param {string} filename
 */
export function downloadTextFile(json, filename) {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * @param {Blob} blob
 * @param {string} filename
 */
export function downloadBlobFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
