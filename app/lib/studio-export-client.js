/**
 * Run studio export in a Web Worker with progress callbacks.
 * Falls back to the main thread when workers are unavailable (Electron file://) or fail.
 */

import { serializeAudioBuffer } from "./audio-buffer-serialize";
import { downloadFormatBlob, normalizeStudioExportFormat } from "./audio-export-formats";
import { isTauriApp, exportMasteredNative } from "./dsp-bridge";

let workerInstance = null;
let exportInFlight = false;
/** After a worker failure, prefer main-thread export for this session. */
let workerDisabled = false;

const WORKER_REPLY_TIMEOUT_MS = 60_000;

function isFileProtocol() {
  if (typeof window === "undefined") return true;
  return window.location?.protocol === "file:";
}

function canUseStudioWorker() {
  return (
    typeof Worker !== "undefined" &&
    !isFileProtocol() &&
    !workerDisabled
  );
}

function terminateWorker() {
  if (workerInstance) {
    try {
      workerInstance.terminate();
    } catch {
      /* ignore */
    }
    workerInstance = null;
  }
}

function getWorker() {
  if (!canUseStudioWorker()) return null;
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
 * @param {"wav"|"mp3"|"wav24"|"wav32"|"flac"|"m4a"} format
 */
export function buildExportFileName(baseFileName, format) {
  const normalized = normalizeStudioExportFormat(format);
  const base = String(baseFileName || "track").replace(/\.[^.]+$/, "");
  if (normalized === "mp3") return `${base}.mp3`;
  if (normalized === "m4a") return `${base}.m4a`;
  if (normalized === "flac") return `${base}.flac`;
  if (normalized === "wav24") return `${base}-24bit.wav`;
  if (normalized === "wav32") return `${base}-32float.wav`;
  return `${base}.wav`;
}

/**
 * Studio export from a file/blob. Uses native Rust mastering in Tauri (WAV/WAV24/WAV32/FLAC/MP3/M4A);
 * falls back to Web Worker / main-thread JS for browser (FLAC → WAV24, M4A → MP3).
 *
 * @param {Blob} blob
 * @param {string} presetId
 * @param {string} baseFileName
 * @param {{ format?: string, onProgress?: (p: { phase: string, pct: number }) => void, startSec?: number, endSec?: number }} [opts]
 */
export async function exportEnhancedFromBlob(blob, presetId, baseFileName, opts = {}) {
  const format = normalizeStudioExportFormat(opts.format);
  const nativeOnly = format === "flac" || format === "m4a";

  if (isTauriApp()) {
    try {
      return await exportMasteredNativePath(blob, presetId, baseFileName, format, opts);
    } catch (err) {
      // FLAC/M4A have no honest JS encoder — never silently deliver WAV24/MP3 as success.
      if (nativeOnly) {
        const detail = err instanceof Error ? err.message : String(err || "native export failed");
        throw new Error(
          `${format.toUpperCase()} export needs Studio native encoder (${detail.slice(0, 120)})`,
        );
      }
      // wav*/mp3: allow JS worker fallback if IPC fails.
    }
  } else if (nativeOnly) {
    // Browser: intentional fallback with formatFallback flag (WAV24 / MP3).
  }

  const arrayBuffer = await blob.arrayBuffer();
  const decodeCtx = new (window.AudioContext || window.webkitAudioContext)();
  let sourceBuffer;
  try {
    sourceBuffer = await decodeCtx.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    try {
      await decodeCtx.close();
    } catch {
      /* ignore */
    }
  }

  if (opts.startSec != null && opts.endSec != null) {
    const { sliceAudioBuffer } = await import("./audio-buffer-serialize");
    sourceBuffer = sliceAudioBuffer(
      sourceBuffer,
      opts.startSec,
      Math.max(opts.startSec + 0.5, opts.endSec),
    );
  }

  return exportEnhancedInWorker(sourceBuffer, presetId, baseFileName, opts);
}

async function exportMasteredNativePath(blob, presetId, baseFileName, format, opts) {
  if (exportInFlight) {
    throw new Error("Another studio export is already running");
  }
  exportInFlight = true;
  try {
    opts.onProgress?.({ phase: "mastering", pct: 15 });
    const bytes = await blob.arrayBuffer();
    const result = await exportMasteredNative(
      bytes,
      presetId,
      format,
      opts.startSec,
      opts.endSec,
    );
    opts.onProgress?.({ phase: "encoding", pct: 90 });
    const outBytes = new Uint8Array(result.wav_bytes);
    const mime =
      format === "mp3"
        ? "audio/mpeg"
        : format === "m4a"
          ? "audio/mp4"
          : format === "flac"
            ? "audio/flac"
            : "audio/wav";
    const outBlob = new Blob([outBytes], { type: mime });
    const fileName = buildExportFileName(baseFileName, format);
    const saved = await downloadFormatBlob(outBlob, fileName);
    opts.onProgress?.({ phase: "done", pct: 100 });
    return {
      format,
      formatFallback: false,
      afterLufs: result.integrated_lufs ?? undefined,
      targetLufs: result.target_lufs ?? undefined,
      engine: "native",
      saveMode: saved?.mode,
      savePath: saved?.path,
    };
  } finally {
    exportInFlight = false;
  }
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

  if (!canUseStudioWorker()) {
    return exportEnhancedMainThread(sourceBuffer, presetId, baseFileName, opts);
  }

  // Playwright / some Chromium builds stall OfflineAudioContext inside Workers.
  // Prefer main-thread export when automation is detected.
  if (typeof navigator !== "undefined" && navigator.webdriver) {
    return exportEnhancedMainThread(sourceBuffer, presetId, baseFileName, opts);
  }

  const worker = getWorker();
  if (!worker) {
    return exportEnhancedMainThread(sourceBuffer, presetId, baseFileName, opts);
  }

  const fileName = buildExportFileName(baseFileName, format);
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const payload = serializeAudioBuffer(sourceBuffer);

  exportInFlight = true;
  return new Promise((resolve, reject) => {
    let settled = false;
    let timeoutId = null;

    const armWorkerIdleTimeout = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        fallbackMainThread("Studio export timed out — retrying on main thread");
      }, WORKER_REPLY_TIMEOUT_MS);
    };

    const cleanup = () => {
      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("error", onWorkerError);
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = null;
    };

    const settle = (fn, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      exportInFlight = false;
      fn(value);
    };

    const fallbackMainThread = (reason) => {
      workerDisabled = true;
      terminateWorker();
      exportInFlight = false;
      settled = true;
      cleanup();
      opts.onProgress?.({ phase: "preparing", pct: 8 });
      exportEnhancedMainThread(sourceBuffer, presetId, baseFileName, opts)
        .then((result) => resolve(result))
        .catch((err) =>
          reject(
            err instanceof Error
              ? err
              : new Error(reason || "Studio export failed"),
          ),
        );
    };

    const onWorkerError = () => {
      fallbackMainThread("Studio worker failed — using main thread");
    };

    const onMessage = (ev) => {
      const msg = ev.data;
      if (!msg || msg.id !== id) return;
      if (msg.type === "progress") {
        // Rearm on each progress tick so a stalled worker cannot leave exportInFlight stuck.
        armWorkerIdleTimeout();
        opts.onProgress?.({ phase: msg.phase, pct: msg.pct });
        return;
      }
      if (msg.type === "error") {
        settle(reject, new Error(msg.message || "Export failed"));
        return;
      }
      if (msg.type === "done") {
        const blob = new Blob([msg.blobBuffer], { type: msg.mime });
        void downloadFormatBlob(blob, msg.fileName || fileName).then((saved) => {
          settle(resolve, {
            format: msg.outFormat || format,
            formatFallback: !!msg.formatFallback,
            afterLufs: msg.afterLufs,
            targetLufs: msg.targetLufs,
            saveMode: saved?.mode,
            savePath: saved?.path,
          });
        }).catch((err) => settle(reject, err instanceof Error ? err : new Error(String(err))));
      }
    };

    worker.addEventListener("message", onMessage);
    worker.addEventListener("error", onWorkerError);
    opts.onProgress?.({ phase: "preparing", pct: 5 });

    try {
      const transfers = payload.channelData.map((ch) => ch.buffer);
      worker.postMessage({ id, presetId, payload, format, fileName }, transfers);
      armWorkerIdleTimeout();
    } catch (err) {
      fallbackMainThread(
        err instanceof Error ? err.message : "Could not start studio worker",
      );
    }
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
    const { measureIntegratedLoudness, targetLufsForPreset } = await import("./lufs-meter");

    opts.onProgress?.({ phase: "preparing", pct: 10 });
    opts.onProgress?.({ phase: "mastering", pct: 40 });
    const enhanced = await renderEnhancedAudioBuffer(sourceBuffer, presetId);

    let afterLufs;
    let targetLufs = targetLufsForPreset(presetId);
    if (typeof targetLufs === "number" || presetId === "measure") {
      const m = await measureIntegratedLoudness(enhanced);
      afterLufs = m.integratedLUFS;
    }

    opts.onProgress?.({ phase: "encoding", pct: 85 });
    const format = normalizeStudioExportFormat(opts.format);
    try {
      const encoded = await downloadAudioBufferAsFormat(enhanced, format, baseFileName);
      opts.onProgress?.({ phase: "done", pct: 100 });
      return {
        format: encoded?.format || format,
        formatFallback: Boolean(encoded?.formatFallback),
        afterLufs,
        targetLufs,
        saveMode: encoded?.saveMode,
        savePath: encoded?.savePath,
      };
    } catch (encodeErr) {
      if (format !== "mp3") throw encodeErr;
      const encoded = await downloadAudioBufferAsFormat(enhanced, "wav", baseFileName);
      opts.onProgress?.({ phase: "done", pct: 100 });
      return {
        format: "wav",
        formatFallback: true,
        afterLufs,
        targetLufs,
        saveMode: encoded?.saveMode,
        savePath: encoded?.savePath,
      };
    }
  } finally {
    exportInFlight = false;
  }
}
