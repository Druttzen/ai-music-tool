import { buildSunoUploadBrief } from "./suno-current";
import { saveOrDownloadBlob } from "./studio-file-save";

export async function exportSunoDraft({ blob, analysis, style, lyrics }) {
  if (!blob?.size) throw new Error("Load or generate an audio draft first");
  const mimeExtension = { "audio/wav": "wav", "audio/x-wav": "wav", "audio/mpeg": "mp3", "audio/flac": "flac", "audio/mp4": "m4a", "audio/ogg": "ogg" }[blob.type];
  const sourceExtension = String(analysis?.fileName || "").split(".").pop().toLowerCase();
  const extension = mimeExtension || (["wav", "mp3", "flac", "m4a", "ogg"].includes(sourceExtension) ? sourceExtension : null);
  if (!extension) throw new Error("Export the draft as WAV from the audio player first");
  const base = `suno-draft-${Date.now()}`;
  const audio = await saveOrDownloadBlob(blob, `${base}.${extension}`);
  try {
    const brief = await saveOrDownloadBlob(new Blob([buildSunoUploadBrief({ analysis, style, lyrics })], { type: "text/plain;charset=utf-8" }), `${base}.txt`);
    return { audio, brief };
  } catch (error) {
    throw new Error(`Audio was saved${audio.path ? ` to ${audio.path}` : ""}, but the Suno brief could not be saved: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}
