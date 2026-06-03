"use client";

/**
 * Safe renderer bridge — no-op in the browser, wired in Electron via preload.js.
 */

/** @returns {boolean} */
export function isElectronApp() {
  return typeof window !== "undefined" && !!window.electronAPI;
}

/** @returns {Promise<{ ok: boolean, version?: string|null, error?: string }>} */
export async function checkForAppUpdates() {
  if (!isElectronApp()) {
    return { ok: false, error: "Updates are only available in the desktop app" };
  }
  return window.electronAPI.checkForUpdates();
}

/** @returns {Promise<void>} */
export async function quitAndInstallUpdate() {
  if (!isElectronApp()) return;
  await window.electronAPI.quitAndInstall();
}

/**
 * @param {(payload: { status?: string, message?: string }) => void} callback
 * @returns {() => void}
 */
export function subscribeToUpdateStatus(callback) {
  if (!isElectronApp() || typeof callback !== "function") return () => {};
  return window.electronAPI.onUpdateStatus(callback);
}
