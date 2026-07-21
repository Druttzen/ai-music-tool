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
  "No GitHub release yet — build from ai-canvas-tool (npm run dist:setup) or run a local Setup.exe from release/.";

function tauriInvoke(command) {
  const invoke = window.__TAURI__?.core?.invoke;
  if (!invoke) throw new Error("Tauri runtime not available");
  return invoke(command);
}

function isElectronApp() {
  return typeof window !== "undefined" && Boolean(window.electronAPI);
}

export async function getCanvasAddonStatus() {
  if (isTauriApp()) return tauriInvoke("suite_canvas_addon_status");
  if (isElectronApp() && window.electronAPI?.canvasAddonStatus) {
    return window.electronAPI.canvasAddonStatus();
  }
  return { ...CANVAS_ADDON, installed: false, path: null };
}

export async function installCanvasAddon() {
  if (isTauriApp()) return tauriInvoke("install_canvas_addon");
  if (isElectronApp() && window.electronAPI?.installCanvasAddon) {
    return window.electronAPI.installCanvasAddon();
  }
  if (typeof window !== "undefined") {
    window.open(CANVAS_ADDON.installUrl, "_blank", "noopener,noreferrer");
    return { ok: true, mode: "browser", url: CANVAS_ADDON.installUrl };
  }
  return { ok: false, error: "Install requires the desktop app or a browser" };
}

export async function launchCanvasAddon() {
  if (isTauriApp()) return tauriInvoke("launch_canvas_addon");
  if (isElectronApp() && window.electronAPI?.launchCanvasAddon) {
    return window.electronAPI.launchCanvasAddon();
  }
  return { ok: false, error: "Opening Canvas requires the desktop app" };
}

export function formatCanvasInstallStatus(result) {
  if (!result?.ok) return result?.error || result?.message || "Could not install AI Canvas Tool";
  if (result.message) return result.message;
  if (result.alreadyInstalled || result.mode === "installed") return "AI Canvas Tool is already installed";
  if (result.mode === "local-installer") return "Opened local Canvas installer — finish setup, then Open";
  if (result.mode === "downloaded") return "Downloaded Canvas installer — finish setup, then Open";
  if (result.mode === "no-release") return "No GitHub release yet — opened Canvas build instructions";
  if (result.mode === "no-release-assets") return "Release has no installer yet — opened Canvas instructions";
  if (result.mode === "docs" || result.mode === "browser") return "Opened Canvas install instructions";
  return "Canvas install started";
}
