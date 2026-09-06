/**
 * Decode audio for analyzers: Web Audio first, Symphonia via Tauri when needed (ALAC/CAF).
 */

import { decodePreviewWavNative, isTauriApp } from "./dsp-bridge";

/**
 * @param {ArrayBuffer} arrayBuffer
 * @param {string} [fileName]
 * @returns {Promise<{ buffer: AudioBuffer, engine: "browser"|"native", previewBlob: Blob|null }>}
 */
export async function decodeAnalyzerAudioBuffer(arrayBuffer, fileName = "track") {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const audioContext = new Ctx();
  try {
    try {
      const buffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
      return { buffer, engine: "browser", previewBlob: null, audioContext };
    } catch (webErr) {
      if (!isTauriApp()) {
        throw webErr;
      }
      const wavBytes = await decodePreviewWavNative(arrayBuffer);
      const previewBlob = new Blob([wavBytes], { type: "audio/wav" });
      const wavCopy = wavBytes.buffer.slice(
        wavBytes.byteOffset,
        wavBytes.byteOffset + wavBytes.byteLength,
      );
      const buffer = await audioContext.decodeAudioData(wavCopy);
      return { buffer, engine: "native", previewBlob, audioContext };
    }
  } catch (err) {
    try {
      await audioContext.close();
    } catch {
      /* ignore */
    }
    const hint = /\.(caf|alac)$/i.test(fileName)
      ? " Apple Lossless needs Studio (Symphonia) or a WAV/FLAC re-encode."
      : "";
    const msg = err instanceof Error ? err.message : "decode failed";
    throw new Error(`Could not decode audio${hint} (${msg})`);
  }
}
