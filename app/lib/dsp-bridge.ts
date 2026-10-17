"use client";

import { runProcess } from "./process-status";

/**
 * Bridge to the native Rust DSP core, exposed through Tauri commands.
 *
 * Thin wrappers around Tauri `invoke` for native DSP. No-op outside the Tauri desktop
 * webview (browser / web export). Uses the global `window.__TAURI__` (enabled via
 * `withGlobalTauri` in tauri.conf.json) so no extra npm dependency is required.
 */

export interface Loudness {
  integrated_lufs: number | null;
  true_peak_dbtp: number;
  sample_peak_dbfs: number;
  /** Max short-term LUFS over the file (Studio native only). */
  short_term_lufs?: number | null;
  /** Max momentary LUFS over the file (Studio native only). */
  momentary_lufs?: number | null;
  channels: number;
  sample_rate: number;
  duration_sec: number;
}

interface TauriGlobal {
  core: { invoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T> };
  event?: { listen: (event: string, handler: (event: {payload: {jobId: string; phase: string; completed: number | null; total: number | null}}) => void) => Promise<() => void> };
}

function tauri(): TauriGlobal | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { __TAURI__?: TauriGlobal };
  return w.__TAURI__ ?? null;
}

export function isTauriApp(): boolean {
  return tauri() !== null;
}

/**
 * Measure EBU R128 loudness from encoded audio bytes (MP3/M4A/AAC/ALAC/OGG/FLAC/WAV)
 * via dsp-core Symphonia decode — no browser-side decode required.
 */
export async function measureLoudnessBytes(bytes: ArrayBuffer): Promise<Loudness> {
  return runProcess("Measure loudness", async () => {
    const t = tauri();
    if (!t) {
      throw new Error("Native DSP core is only available in the Tauri desktop build");
    }
    return t.core.invoke<Loudness>("measure_loudness_bytes", {
      bytes: new Uint8Array(bytes),
    });
  });
}

export interface StereoPhase {
  correlation: number;
  left_peak: number;
  right_peak: number;
  mono_peak: number;
  mono_cancel_db: number;
  out_of_phase: boolean;
}

export async function measureStereoPhaseBytes(bytes: ArrayBuffer): Promise<StereoPhase> {
  return runProcess("Measure stereo phase", async () => {
    const t = tauri();
    if (!t) {
      throw new Error("Native DSP core is only available in the Tauri desktop build");
    }
    return t.core.invoke<StereoPhase>("measure_stereo_phase_bytes", {
      bytes: new Uint8Array(bytes),
    });
  });
}

export interface ExportMasteredResult {
  wav_bytes: number[];
  integrated_lufs: number | null;
  true_peak_dbtp: number;
  target_lufs: number | null;
  preset: string;
  bits_per_sample: number;
  /** Encoded output sample rate (48 kHz after Studio export resample). */
  sample_rate?: number;
}

/**
 * Decode, master, and encode via the native Rust DSP core (WAV/FLAC/MP3/M4A).
 */
export async function exportMasteredNative(
  bytes: ArrayBuffer,
  presetId: string,
  format: "wav" | "wav24" | "wav32" | "flac" | "mp3" | "m4a",
  startSec?: number,
  endSec?: number,
  onProgress?: (progress: {phase: string; pct: number | null; completed?: number | null; total?: number | null}) => void,
): Promise<ExportMasteredResult> {
  const t = tauri();
  if (!t) {
    throw new Error("Native export is only available in the Tauri desktop build");
  }
  const jobId = globalThis.crypto?.randomUUID?.() ?? `export-${Date.now()}-${Math.random()}`;
  const unlisten = await t.event?.listen("studio-mastering-progress", ({ payload }) => {
    if (payload.jobId !== jobId) return;
    onProgress?.({ phase: payload.phase, completed: payload.completed, total: payload.total,
      pct: payload.total && payload.completed != null ? payload.completed / payload.total * 100 : null });
  }).catch(() => () => {});
  try {
    return await t.core.invoke<ExportMasteredResult>("export_mastered", {
      bytes: new Uint8Array(bytes),
      presetId,
      format,
      startSec: startSec ?? null,
      endSec: endSec ?? null,
      jobId,
    });
  } finally {
    unlisten?.();
  }
}

/**
 * Symphonia decode → 16-bit stereo WAV for preview when Web Audio cannot decode
 * (Apple Lossless / CAF, some FLAC/M4A variants).
 */
export async function decodePreviewWavNative(bytes: ArrayBuffer): Promise<Uint8Array> {
  return runProcess("Prepare audio preview", async () => {
    const t = tauri();
    if (!t) {
      throw new Error("Native decode is only available in the Tauri desktop build");
    }
    const out = await t.core.invoke<number[]>("decode_preview_wav_bytes", {
      bytes: new Uint8Array(bytes),
    });
    return new Uint8Array(out);
  });
}
