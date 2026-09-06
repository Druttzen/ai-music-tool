/**
 * Encode mastered buffers to download formats (browser).
 */

import {
  audioBufferToWavBlob,
  audioBufferToWav24Blob,
  audioBufferToWav32Blob,
  downloadAudioBlob,
} from "./audio-enhancer";

/** @typedef {"wav"|"wav24"|"wav32"|"flac"|"mp3"|"m4a"} StudioExportFormat */

/**
 * Normalize legacy/alias format ids to supported studio export formats.
 * @param {string|undefined|null} format
 * @returns {StudioExportFormat}
 */
export function normalizeStudioExportFormat(format) {
  const f = String(format || "wav").toLowerCase();
  if (f === "alac" || f === "caf") {
    throw new Error(
      "ALAC/CAF is decode-only — choose FLAC (lossless) or M4A (AAC) for studio export",
    );
  }
  if (f === "mp3") return "mp3";
  if (f === "m4a" || f === "aac" || f === "mp4-audio" || f === "apple") return "m4a";
  if (f === "wav24" || f === "24bit" || f === "wav-24") return "wav24";
  if (f === "wav32" || f === "32bit" || f === "float" || f === "wav-float") return "wav32";
  if (f === "flac" || f === "wav-lossless" || f === "lossless") return "flac";
  return "wav";
}

/**
 * @param {AudioBuffer} buffer
 * @returns {Promise<Blob>}
 */
export async function audioBufferToMp3Blob(buffer) {
  const lamejs = await import("lamejs");
  const Mp3Encoder = lamejs.Mp3Encoder || lamejs.default?.Mp3Encoder;
  if (!Mp3Encoder) throw new Error("MP3 encoder unavailable");

  const channels = Math.min(2, buffer.numberOfChannels);
  const sampleRate = buffer.sampleRate;
  const left = floatTo16(buffer.getChannelData(0));
  const right = channels > 1 ? floatTo16(buffer.getChannelData(1)) : left;
  const encoder = new Mp3Encoder(channels, sampleRate, 256);
  const block = 1152;
  const chunks = [];

  for (let i = 0; i < left.length; i += block) {
    const l = left.subarray(i, i + block);
    const r = right.subarray(i, i + block);
    const buf =
      channels === 2 ? encoder.encodeBuffer(l, r) : encoder.encodeBuffer(l);
    if (buf.length) chunks.push(new Int8Array(buf));
  }
  const end = encoder.flush();
  if (end.length) chunks.push(new Int8Array(end));

  return new Blob(chunks, { type: "audio/mpeg" });
}

/**
 * @param {Blob} blob
 * @param {string} fileName
 */
export function downloadFormatBlob(blob, fileName) {
  downloadAudioBlob(blob, fileName);
}

/**
 * @param {AudioBuffer} buffer
 * @param {string} format
 * @param {string} baseFileName
 */
export async function downloadAudioBufferAsFormat(buffer, format, baseFileName) {
  const normalized = normalizeStudioExportFormat(format);
  const base = String(baseFileName || "track").replace(/\.[^.]+$/, "");
  if (normalized === "mp3") {
    downloadFormatBlob(await audioBufferToMp3Blob(buffer), `${base}.mp3`);
    return { format: "mp3", formatFallback: false };
  }
  if (normalized === "flac") {
    // Browser path has no FLAC encoder; lossless fallback is 24-bit WAV.
    // Studio/Tauri uses native flacenc via dsp-bridge instead.
    downloadFormatBlob(audioBufferToWav24Blob(buffer), `${base}-24bit.wav`);
    return { format: "wav24", formatFallback: true };
  }
  if (normalized === "m4a") {
    // Browser path has no AAC/M4A encoder; fall back to MP3 for delivery.
    // Studio/Tauri uses rusty_aac + custom ISOBMFF muxer via dsp-bridge instead.
    downloadFormatBlob(await audioBufferToMp3Blob(buffer), `${base}.mp3`);
    return { format: "mp3", formatFallback: true };
  }
  if (normalized === "wav32") {
    downloadFormatBlob(audioBufferToWav32Blob(buffer), `${base}-32float.wav`);
    return { format: "wav32", formatFallback: false };
  }
  if (normalized === "wav24") {
    downloadFormatBlob(audioBufferToWav24Blob(buffer), `${base}-24bit.wav`);
    return { format: "wav24", formatFallback: false };
  }
  downloadFormatBlob(audioBufferToWavBlob(buffer), `${base}.wav`);
  return { format: "wav", formatFallback: false };
}

/** @param {Float32Array} data */
function floatTo16(data) {
  const out = new Int16Array(data.length);
  for (let i = 0; i < data.length; i++) {
    const s = Math.max(-1, Math.min(1, data[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}
