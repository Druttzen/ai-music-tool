/**
 * Encode mastered buffers to download formats (browser).
 */

import {
  audioBufferToWavBlob,
  audioBufferToWav24Blob,
  downloadAudioBlob,
} from "./audio-enhancer";

/** @typedef {"wav"|"wav24"|"mp3"} StudioExportFormat */

/**
 * Normalize legacy/alias format ids to supported studio export formats.
 * @param {string|undefined|null} format
 * @returns {StudioExportFormat}
 */
export function normalizeStudioExportFormat(format) {
  const f = String(format || "wav").toLowerCase();
  if (f === "mp3") return "mp3";
  if (f === "wav24" || f === "24bit" || f === "wav-24") return "wav24";
  // Legacy UI stored "flac" but output was always 16-bit WAV.
  if (f === "flac" || f === "wav-lossless" || f === "lossless") return "wav";
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
    return;
  }
  if (normalized === "wav24") {
    downloadFormatBlob(audioBufferToWav24Blob(buffer), `${base}-24bit.wav`);
    return;
  }
  downloadFormatBlob(audioBufferToWavBlob(buffer), `${base}.wav`);
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
