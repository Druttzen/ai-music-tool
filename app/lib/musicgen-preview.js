/**
 * Load a MusicGen WAV blob into the analyzer report shape.
 */

import { analyzeAudioBuffer } from "./audio-analyzer";

/**
 * @param {Blob|File} blob
 * @param {{ prompt?: string, model?: string, durationSec?: number, fileName?: string }} meta
 */
export async function buildMusicGenAnalysisReport(blob, meta = {}) {
  const fileName = meta.fileName || `musicgen-preview-${Date.now()}.wav`;
  const file =
    blob instanceof File ? blob : new File([blob], fileName, { type: blob.type || "audio/wav" });
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new (globalThis.AudioContext || globalThis.webkitAudioContext)();
  let buffer;
  try {
    buffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    try {
      await audioContext.close();
    } catch {
      /* ignore */
    }
  }
  const report = analyzeAudioBuffer(buffer, file.name);
  const prompt = String(meta.prompt || "").trim();
  const model = meta.model || "musicgen";
  const durationSec = meta.durationSec ?? report.duration;
  return {
    ...report,
    waveformSource: "sample",
    sourceEngine: "musicgen",
    musicGenPrompt: prompt,
    musicGenModel: model,
    musicGenDurationSec: durationSec,
    trackSummary: prompt
      ? `MusicGen preview (${model}, ${durationSec}s): ${prompt.slice(0, 160)}`
      : report.trackSummary,
    vocals: "Instrumental (MusicGen)",
  };
}

/** @param {Blob|File} blob @param {string} [fileName] */
export function downloadMusicGenBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName || `musicgen-preview-${Date.now()}.wav`;
  a.click();
  URL.revokeObjectURL(url);
}
