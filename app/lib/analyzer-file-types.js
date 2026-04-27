/**
 * File types the drag-drop audio/image analyzers support (matches UI copy).
 */

const AUDIO_EXT = new Set([".wav", ".mp3", ".ogg", ".m4a"]);
const AUDIO_MIME = new Set([
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/mpeg",
  "audio/mp3",
  "audio/ogg",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
]);

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png"]);
const IMAGE_MIME = new Set(["image/jpeg", "image/jpg", "image/png", "image/x-png"]);

function extname(name) {
  if (!name || typeof name !== "string") return "";
  const i = name.lastIndexOf(".");
  return i < 0 ? "" : name.slice(i).toLowerCase();
}

/**
 * @param {File} file
 * @returns {boolean}
 */
export function isSupportedAudioFile(file) {
  const t = (file?.type || "").toLowerCase().trim();
  if (t && AUDIO_MIME.has(t)) return true;
  return AUDIO_EXT.has(extname(file?.name || ""));
}

/**
 * @param {File} file
 * @returns {boolean}
 */
export function isSupportedImageFile(file) {
  const t = (file?.type || "").toLowerCase().trim();
  if (t && IMAGE_MIME.has(t)) return true;
  return IMAGE_EXT.has(extname(file?.name || ""));
}

export const SUPPORTED_AUDIO_ACCEPT =
  ".wav,.mp3,.ogg,.m4a,audio/wav,audio/wave,audio/mpeg,audio/ogg,audio/mp4,audio/m4a";

export const SUPPORTED_IMAGE_ACCEPT = ".jpg,.jpeg,.png,image/jpeg,image/png";

export const SUPPORTED_AUDIO_LABEL = "WAV, MP3, OGG, M4A";
export const SUPPORTED_IMAGE_LABEL = "JPG, JPEG, PNG";
