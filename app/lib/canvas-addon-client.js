/** Canvas integration install and launch helpers. */
import { isTauriApp } from "./dsp-bridge";

export const CANVAS_ADDON = {
  id: "canvas",
  title: "AI Canvas Tool",
  description: "Create short Spotify Canvas loops from the current track and album art.",
  repoUrl: "https://github.com/Druttzen/ai-canvas-tool",
  installUrl: "https://github.com/Druttzen/ai-canvas-tool#install-windows",
  releasesUrl: "https://github.com/Druttzen/ai-canvas-tool/releases",
};

export const CANVAS_INSTALL_HINT =
  "Downloads the latest Setup.exe from GitHub Releases (or opens a local installer if present).";

export const CANVAS_DESKTOP_REQUIRED =
  "Open Studio desktop app to download and install Canvas";

function tauriInvoke(command, args) {
  const invoke = window.__TAURI__?.core?.invoke;
  if (!invoke) throw new Error("Tauri runtime not available");
  return args === undefined ? invoke(command) : invoke(command, args);
}

function isElectronApp() {
  return typeof window !== "undefined" && Boolean(window.electronAPI);
}

/** True when Tauri Studio or Electron can run native Canvas install/launch. */
export function isDesktopAddonHost() {
  return isTauriApp() || isElectronApp();
}

export async function getCanvasAddonStatus() {
  if (isTauriApp()) return tauriInvoke("suite_canvas_addon_status");
  if (isElectronApp() && window.electronAPI?.canvasAddonStatus) {
    return window.electronAPI.canvasAddonStatus();
  }
  return { ...CANVAS_ADDON, installed: false, path: null, desktop: false };
}

export async function installCanvasAddon() {
  if (isTauriApp()) return tauriInvoke("install_canvas_addon");
  if (isElectronApp() && window.electronAPI?.installCanvasAddon) {
    return window.electronAPI.installCanvasAddon();
  }
  return {
    ok: false,
    mode: "desktop-required",
    error: CANVAS_DESKTOP_REQUIRED,
  };
}

export async function launchCanvasAddon() {
  if (isTauriApp()) return tauriInvoke("launch_canvas_addon");
  if (isElectronApp() && window.electronAPI?.launchCanvasAddon) {
    return window.electronAPI.launchCanvasAddon();
  }
  return { ok: false, error: CANVAS_DESKTOP_REQUIRED };
}

export function formatCanvasInstallStatus(result) {
  if (!result?.ok) {
    if (result?.mode === "desktop-required") return CANVAS_DESKTOP_REQUIRED;
    if (result?.mode === "download-failed") {
      return result.error || result.message || "Could not download Canvas installer from GitHub";
    }
    return result?.error || result?.message || "Could not install AI Canvas Tool";
  }
  if (result.message) return result.message;
  if (result.alreadyInstalled || result.mode === "installed") return "AI Canvas Tool is already installed";
  if (result.mode === "local-installer") return "Opened local Canvas installer — finish setup, then Open";
  if (result.mode === "downloaded") return "Downloaded Canvas installer — finish setup, then Open";
  if (result.mode === "no-release") return "No GitHub release yet — opened Canvas releases page";
  if (result.mode === "no-release-assets") return "Release has no installer assets — opened Canvas releases page";
  if (result.mode === "docs" || result.mode === "browser") return "Opened Canvas install instructions";
  return "Canvas install started";
}
