import { makeAudioCacheKey, putAudioCacheEntries } from "./audio-cache";

/** Keep generated audio available for playback and export after reloading. */
export async function cacheGeneratedAudioDraft(file, report) {
  const next = { ...report, fileSize: file.size };
  try {
    const keys = await putAudioCacheEntries(file, makeAudioCacheKey(file), report.duration);
    return { ...next, ...keys };
  } catch {
    return { ...next, audioCacheWarning: "Draft loaded, but local audio storage failed. Export the audio before closing Studio." };
  }
}
