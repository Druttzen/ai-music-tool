"use client";

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
 * Measure EBU R128 loudness from encoded audio bytes (MP3/M4A/OGG/FLAC/WAV)
 * via dsp-core Symphonia decode — no browser-side decode required.
 */
export async function measureLoudnessBytes(bytes: ArrayBuffer): Promise<Loudness> {
  const t = tauri();
  if (!t) {
    throw new Error("Native DSP core is only available in the Tauri desktop build");
  }
  return t.core.invoke<Loudness>("measure_loudness_bytes", {
    bytes: new Uint8Array(bytes),
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
  const t = tauri();
  if (!t) {
    throw new Error("Native DSP core is only available in the Tauri desktop build");
  }
  return t.core.invoke<StereoPhase>("measure_stereo_phase_bytes", {
    bytes: new Uint8Array(bytes),
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
 * Decode, master, and encode to WAV via the native Rust DSP core.
 */
export async function exportMasteredNative(
  bytes: ArrayBuffer,
  presetId: string,
  format: "wav" | "wav24" | "mp3",
  startSec?: number,
  endSec?: number,
): Promise<ExportMasteredResult> {
  const t = tauri();
  if (!t) {
    throw new Error("Native export is only available in the Tauri desktop build");
  }
  return t.core.invoke<ExportMasteredResult>("export_mastered", {
    bytes: new Uint8Array(bytes),
    presetId,
    format,
    startSec: startSec ?? null,
    endSec: endSec ?? null,
  });
}
