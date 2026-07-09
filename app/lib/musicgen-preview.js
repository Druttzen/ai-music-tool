/**
 * Load a MusicGen WAV blob into the analyzer report shape.
 */

import { analyzeAudioBuffer } from "./audio-analyzer";

/**
 * @param {Blob|File} blob
 * @param {{ prompt?: string, model?: string, durationSec?: number, fileName?: string, mode?: string, highlightMelody?: boolean }} meta
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
  const highlightMelody = !!meta.highlightMelody;
  return {
    ...report,
    waveformSource: "sample",
    sourceEngine: "musicgen",
    musicGenPrompt: prompt,
    musicGenModel: model,
    musicGenDurationSec: durationSec,
    musicGenMode: meta.mode || "text",
    musicGenHighlightMelody: highlightMelody,
    trackSummary: prompt
      ? `MusicGen preview (${model}, ${durationSec}s${highlightMelody ? ", highlight melody" : ""}): ${prompt.slice(0, 160)}`
      : report.trackSummary,
    vocals: "Instrumental (MusicGen)",
  };
}

export async function enrichMusicGenReportWithSidecar(file, report) {
  try {
    const { analyzeAudioViaSidecar } = await import("./sidecar-bridge");
    const { mergeSidecarAnalysis } = await import("./audio-analyzer-sidecar");
    const sidecar = await analyzeAudioViaSidecar(file, file.name);
    const merged = mergeSidecarAnalysis(report, sidecar);
    return {
      ...merged,
      sourceEngine: "musicgen",
      musicGenPrompt: report.musicGenPrompt,
      musicGenModel: report.musicGenModel,
      musicGenDurationSec: report.musicGenDurationSec,
      musicGenMode: report.musicGenMode,
      musicGenHighlightMelody: report.musicGenHighlightMelody,
      analysisEngine: "musicgen+sidecar",
      trackSummary: report.trackSummary,
      vocals: report.vocals,
    };
  } catch {
    return report;
  }
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
