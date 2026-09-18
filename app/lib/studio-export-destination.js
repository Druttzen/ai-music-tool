/**
 * Remembered Studio export output folder (Tauri native picker).
 * Empty / unset means the default `{data}/exports` directory.
 */

import { isTauriApp } from "./dsp-bridge";
import { safeLocalStorage } from "./safe-local-storage";

export const STUDIO_EXPORT_DIR_KEY = "aimc-studio-export-dir";

function tauriApi() {
  if (typeof window === "undefined") return null;
  return window.__TAURI__ ?? null;
}

/**
 * @param {unknown} value
 * @returns {string|null}
 */
export function normalizeStudioExportDirectory(value) {
  const trimmed = String(value || "").trim();
  return trimmed || null;
}

/** @returns {string|null} absolute folder path, or null for Studio default exports */
export function getStoredStudioExportDirectory() {
  return normalizeStudioExportDirectory(safeLocalStorage.get(STUDIO_EXPORT_DIR_KEY, ""));
}

/** @param {string|null|undefined} dir */
export function setStoredStudioExportDirectory(dir) {
  const normalized = normalizeStudioExportDirectory(dir);
  if (!normalized) {
    safeLocalStorage.remove(STUDIO_EXPORT_DIR_KEY);
    return;
  }
  safeLocalStorage.set(STUDIO_EXPORT_DIR_KEY, normalized);
}

/**
 * @param {unknown} opts
 * @returns {string|null}
 */
export function resolveStudioExportDirectory(opts = {}) {
  const fromOpts = normalizeStudioExportDirectory(opts?.outputDir);
  if (fromOpts) return fromOpts;
  return getStoredStudioExportDirectory();
}

/**
 * @param {string|null|undefined} dir
 * @param {{ fallback?: string, max?: number }} [opts]
 */
export function formatExportDirLabel(dir, opts = {}) {
  const fallback = opts.fallback || "Studio exports";
  const max = typeof opts.max === "number" ? opts.max : 64;
  const s = String(dir || "").trim();
  if (!s) return fallback;
  if (s.length <= max) return s;
  const keep = Math.max(12, max - 1);
  return `…${s.slice(-keep)}`;
}

/** @returns {Promise<string|null>} */
export async function fetchDefaultStudioExportsDir() {
  const t = tauriApi();
  if (!isTauriApp() || !t?.core?.invoke) return null;
  try {
    const path = await t.core.invoke("get_exports_dir");
    return normalizeStudioExportDirectory(path);
  } catch {
    return null;
  }
}

/**
 * Native folder picker. Returns the chosen absolute path, or null if cancelled.
 * @param {string|null|undefined} [current]
 * @returns {Promise<string|null>}
 */
export async function pickStudioExportDirectory(current) {
  const t = tauriApi();
  if (!isTauriApp() || !t?.core?.invoke) {
    throw new Error("Choose folder is available in Studio desktop");
  }
  const picked = await t.core.invoke("pick_export_directory", {
    current: normalizeStudioExportDirectory(current),
  });
  return normalizeStudioExportDirectory(picked);
}
