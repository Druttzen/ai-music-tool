/**
 * Run studio export in a Web Worker with progress callbacks.
 */

import { serializeAudioBuffer } from "./audio-buffer-serialize";
import { downloadFormatBlob, normalizeStudioExportFormat } from "./audio-export-formats";

let workerInstance = null;
let exportInFlight = false;

function getWorker() {
  if (typeof Worker === "undefined") return null;
  if (!workerInstance) {
    workerInstance = new Worker(
      new URL("../workers/studio-export.worker.js", import.meta.url),
      { type: "module" },
    );
  }
  return workerInstance;
}

/**
 * @param {string} baseFileName — stem without extension (may already include -enhanced- or -highlight- suffix)
 * @param {"wav"|"mp3"} format
 */
export function buildExportFileName(baseFileName, format) {
  const normalized = normalizeStudioExportFormat(format);
  const base = String(baseFileName || "track").replace(/\.[^.]+$/, "");
  const ext = normalized === "mp3" ? "mp3" : "wav";
  return `${base}.${ext}`;
}

/**
 * @param {AudioBuffer} sourceBuffer
 * @param {string} presetId
 * @param {string} baseFileName
 * @param {{ format?: string, onProgress?: (p: { phase: string, pct: number }) => void }} [opts]
 */
export function exportEnhancedInWorker(sourceBuffer, presetId, baseFileName, opts = {}) {
  const format = normalizeStudioExportFormat(opts.format);
  if (exportInFlight) {
    return Promise.reject(new Error("Another studio export is already running"));
  }

  const fileName = buildExportFileName(baseFileName, format);
  const worker = getWorker();
  if (!worker) {
    return exportEnhancedMainThread(sourceBuffer, presetId, baseFileName, opts);
  }

  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const payload = serializeAudioBuffer(sourceBuffer);

  exportInFlight = true;
  return new Promise((resolve, reject) => {
    const onMessage = (ev) => {
      const msg = ev.data;
      if (msg.id !== id) return;
      if (msg.type === "progress") {
        opts.onProgress?.({ phase: msg.phase, pct: msg.pct });
        return;
      }
      if (msg.type === "error") {
        worker.removeEventListener("message", onMessage);
        exportInFlight = false;
        reject(new Error(msg.message || "Export failed"));
        return;
      }
      if (msg.type === "done") {
        worker.removeEventListener("message", onMessage);
        exportInFlight = false;
        const blob = new Blob([msg.blobBuffer], { type: msg.mime });
        downloadFormatBlob(blob, msg.fileName || fileName);
        resolve({
          format: msg.outFormat || format,
          formatFallback: !!msg.formatFallback,
          afterLufs: msg.afterLufs,
          targetLufs: msg.targetLufs,
        });
      }
    };
    worker.addEventListener("message", onMessage);
    opts.onProgress?.({ phase: "preparing", pct: 5 });
    const transfers = payload.channelData.map((ch) => ch.buffer);
    worker.postMessage({ id, presetId, payload, format, fileName }, transfers);
  });
}

async function exportEnhancedMainThread(sourceBuffer, presetId, baseFileName, opts) {
  if (exportInFlight) {
    throw new Error("Another studio export is already running");
  }
  exportInFlight = true;
  try {
    const { renderEnhancedAudioBuffer } = await import("./audio-enhancer");
    const { downloadAudioBufferAsFormat } = await import("./audio-export-formats");
    opts.onProgress?.({ phase: "mastering", pct: 40 });
    const enhanced = await renderEnhancedAudioBuffer(sourceBuffer, presetId);
    opts.onProgress?.({ phase: "encoding", pct: 85 });
    const format = normalizeStudioExportFormat(opts.format);
    try {
      await downloadAudioBufferAsFormat(enhanced, format, baseFileName);
      opts.onProgress?.({ phase: "done", pct: 100 });
      return { format, formatFallback: false };
    } catch (encodeErr) {
      if (format !== "mp3") throw encodeErr;
      await downloadAudioBufferAsFormat(enhanced, "wav", baseFileName);
      opts.onProgress?.({ phase: "done", pct: 100 });
      return { format: "wav", formatFallback: true };
    }
  } finally {
    exportInFlight = false;
  }
}
