/**
 * Suite addons — AI Canvas Tool install / launch (desktop) + catalog metadata (web).
 * Install URLs stay aligned with lib/suite-handoff-paths.json addons.canvas.
 */
import { isTauriApp } from "./dsp-bridge";

export const CANVAS_ADDON = {
  id: "canvas",
  title: "AI Canvas Tool",
  description: "Spotify Canvas loops from album art — suite addon for Music Creator",
  repoUrl: "https://github.com/Druttzen/ai-canvas-tool",
  installUrl: "https://github.com/Druttzen/ai-canvas-tool/releases/latest",
};

function tauriInvoke(cmd, args) {
  const w = window;
  if (!w.__TAURI__?.core?.invoke) throw new Error("Tauri runtime not available");
  return w.__TAURI__.core.invoke(cmd, args);
}

function isElectronApp() {
  return typeof window !== "undefined" && Boolean(window.electronAPI);
}

/**
 * @returns {Promise<{ id: string, title: string, description: string, installed: boolean, path?: string|null, repoUrl?: string|null, installUrl?: string|null }>}
 */
export async function getCanvasAddonStatus() {
  if (isTauriApp()) {
    return tauriInvoke("suite_canvas_addon_status");
  }
  if (isElectronApp() && window.electronAPI?.canvasAddonStatus) {
    return window.electronAPI.canvasAddonStatus();
  }
  return {
    ...CANVAS_ADDON,
    installed: false,
    path: null,
  };
}

/**
 * @returns {Promise<{ ok: boolean, launched?: boolean, alreadyInstalled?: boolean, mode?: string, path?: string, url?: string, error?: string }>}
 */
export async function installCanvasAddon() {
  if (isTauriApp()) {
    return tauriInvoke("install_canvas_addon");
  }
  if (isElectronApp() && window.electronAPI?.installCanvasAddon) {
    return window.electronAPI.installCanvasAddon();
  }
  if (typeof window !== "undefined") {
    window.open(CANVAS_ADDON.installUrl, "_blank", "noopener,noreferrer");
    return { ok: true, mode: "browser", url: CANVAS_ADDON.installUrl };
  }
  return { ok: false, error: "Install Canvas requires the desktop app or a browser" };
}

/**
 * @returns {Promise<{ ok: boolean, launched?: boolean, path?: string, error?: string }>}
 */
export async function launchCanvasAddon() {
  if (isTauriApp()) {
    return tauriInvoke("launch_canvas_addon");
  }
  if (isElectronApp() && window.electronAPI?.launchCanvasAddon) {
    return window.electronAPI.launchCanvasAddon();
  }
  return {
    ok: false,
    error: "Open Canvas Tool requires the desktop app (Tauri Studio or Electron)",
  };
}

export function formatCanvasInstallStatus(result) {
  if (!result?.ok) return result?.error || "Could not install Canvas addon";
  if (result.alreadyInstalled || result.mode === "installed") {
    return "AI Canvas Tool is already installed";
  }
  if (result.mode === "local-installer") {
    return "Opened local Canvas installer — finish setup, then Open Canvas Tool";
  }
  if (result.mode === "downloaded") {
    return "Downloaded Canvas installer — finish setup, then Open Canvas Tool";
  }
  if (result.mode === "browser") {
    return "Opened Canvas download page — install, then return here";
  }
  return "Canvas addon install started";
}
