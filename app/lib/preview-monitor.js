/**
 * Preview-only monitoring utilities: A/B gain match, spectrum, headphone EQ.
 */

import { measureIntegratedLoudness } from "./lufs-meter";
import { isTauriApp, measureLoudnessBytes } from "./dsp-bridge";

/**
 * Gain linear to match reference integrated LUFS to program LUFS.
 * @param {number} programLufs
 * @param {number} referenceLufs
 */
export function gainToMatchLufs(programLufs, referenceLufs) {
  if (!Number.isFinite(programLufs) || !Number.isFinite(referenceLufs)) return 1;
  return Math.pow(10, (programLufs - referenceLufs) / 20);
}

/**
 * Integrated LUFS from encoded bytes. Studio prefers Symphonia via dsp-bridge;
 * browser falls back to Web Audio decode + JS R128.
 * @param {ArrayBuffer} bytes
 * @returns {Promise<{ integratedLUFS: number, engine: "native"|"browser" }>}
 */
export async function measureIntegratedLufsFromBytes(bytes) {
  if (isTauriApp()) {
    try {
      const native = await measureLoudnessBytes(bytes.slice(0));
      if (typeof native.integrated_lufs === "number" && Number.isFinite(native.integrated_lufs)) {
        return { integratedLUFS: native.integrated_lufs, engine: "native" };
      }
    } catch {
      /* fall through to Web Audio */
    }
  }

  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) {
    throw new Error("Web Audio is not supported in this environment");
  }
  const ctx = new Ctx();
  try {
    const buffer = await ctx.decodeAudioData(bytes.slice(0));
    const m = await measureIntegratedLoudness(buffer);
    return { integratedLUFS: m.integratedLUFS, engine: "browser" };
  } finally {
    try {
      await ctx.close();
    } catch {
      /* ignore */
    }
  }
}

export const PREVIEW_EQ_STORAGE_KEY = "aimc-preview-headphone-eq";

/** @typedef {{ enabled: boolean, bands: { freq: number, gain: number, q: number }[] }} PreviewEqState */

/** @returns {PreviewEqState} */
export function defaultPreviewEqState() {
  return {
    enabled: false,
    bands: [
      { freq: 80, gain: 0, q: 0.7 },
      { freq: 250, gain: 0, q: 0.9 },
      { freq: 1000, gain: 0, q: 0.9 },
      { freq: 4000, gain: 0, q: 0.9 },
      { freq: 10000, gain: 0, q: 0.7 },
    ],
  };
}

/** @returns {PreviewEqState} */
export function loadPreviewEqState() {
  if (typeof window === "undefined") return defaultPreviewEqState();
  try {
    const raw = window.localStorage.getItem(PREVIEW_EQ_STORAGE_KEY);
    if (!raw) return defaultPreviewEqState();
    const parsed = JSON.parse(raw);
    const base = defaultPreviewEqState();
    const bands = Array.isArray(parsed?.bands) ? parsed.bands.slice(0, 5) : [];
    return {
      enabled: Boolean(parsed?.enabled),
      bands: base.bands.map((fallback, i) => {
        const b = bands[i] || {};
        return {
          freq: Math.min(20_000, Math.max(20, Number(b.freq) || fallback.freq)),
          gain: Math.min(24, Math.max(-24, Number(b.gain) || 0)),
          q: Math.min(20, Math.max(0.1, Number(b.q) || fallback.q)),
        };
      }),
    };
  } catch {
    return defaultPreviewEqState();
  }
}

/** @param {PreviewEqState} state */
export function savePreviewEqState(state) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREVIEW_EQ_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota */
  }
}
