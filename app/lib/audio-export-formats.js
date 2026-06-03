/**
 * Encode mastered buffers to download formats (browser).
 */

import { audioBufferToWavBlob, downloadAudioBlob } from "./audio-enhancer";

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
  const encoder = new Mp3Encoder(channels, sampleRate, 192);
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

/** Lossless export — 16-bit stereo WAV packaged for FLAC slot (PCM in WAV container). */
export function audioBufferToFlacBlob(buffer) {
  return audioBufferToWavBlob(buffer);
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
 * @param {"wav"|"mp3"|"flac"} format
 * @param {string} baseFileName
 */
export async function downloadAudioBufferAsFormat(buffer, format, baseFileName) {
  const base = String(baseFileName || "track").replace(/\.[^.]+$/, "");
  if (format === "mp3") {
    downloadFormatBlob(await audioBufferToMp3Blob(buffer), `${base}.mp3`);
    return;
  }
  if (format === "flac") {
    downloadFormatBlob(audioBufferToFlacBlob(buffer), `${base}.flac`);
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
