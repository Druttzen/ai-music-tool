/**
 * Suite addons — Canvas + Music Video install / launch (desktop) + catalog metadata (web).
 * Metadata stays aligned with lib/suite-handoff-paths.json addons.*.
 */
import { isTauriApp } from "./dsp-bridge";

export const CANVAS_ADDON = {
  id: "canvas",
  title: "AI Canvas Tool",
  description: "Spotify Canvas loops from album art — suite addon for Music Creator",
  repoUrl: "https://github.com/Druttzen/ai-canvas-tool",
  installUrl: "https://github.com/Druttzen/ai-canvas-tool#install-windows",
  releasesUrl: "https://github.com/Druttzen/ai-canvas-tool/releases",
};

export const MUSIC_VIDEO_ADDON = {
  id: "musicVideo",
  title: "Music Video (Glitchframe)",
  description: "Local GPU music video from track + optional stills — suite addon",
  repoUrl: "https://github.com/6Morpheus6/Glitchframe",
  installUrl: "https://github.com/6Morpheus6/Glitchframe#readme",
  releasesUrl: "https://github.com/6Morpheus6/Glitchframe/releases",
};

export const SUITE_ADDON_CATALOG = [CANVAS_ADDON, MUSIC_VIDEO_ADDON];

export const CANVAS_INSTALL_HINT =
  "No GitHub release yet — build from ai-canvas-tool (npm run dist:setup) or run a local Setup.exe from release/.";

function tauriInvoke(cmd, args) {
  const w = window;
  if (!w.__TAURI__?.core?.invoke) throw new Error("Tauri runtime not available");
  return w.__TAURI__.core.invoke(cmd, args);
}

function isElectronApp() {
  return typeof window !== "undefined" && Boolean(window.electronAPI);
}

function catalogMeta(addonId) {
  return SUITE_ADDON_CATALOG.find((a) => a.id === addonId) || { id: addonId, title: addonId, description: "" };
}

/**
 * @param {string} [addonId]
 */
export async function getAddonStatus(addonId = "canvas") {
  const id = String(addonId || "canvas");
  if (isTauriApp()) {
    if (id === "canvas") return tauriInvoke("suite_canvas_addon_status");
    try {
      return await tauriInvoke("suite_addon_status", { addonId: id });
    } catch {
      return { ...catalogMeta(id), installed: false, path: null };
    }
  }
  if (isElectronApp()) {
    if (id === "canvas" && window.electronAPI?.canvasAddonStatus) {
      return window.electronAPI.canvasAddonStatus();
    }
    if (window.electronAPI?.suiteAddonStatus) {
      return window.electronAPI.suiteAddonStatus(id);
    }
  }
  return {
    ...catalogMeta(id),
    installed: false,
    path: null,
  };
}

export async function getCanvasAddonStatus() {
  return getAddonStatus("canvas");
}

/**
 * @param {string} [addonId]
 */
export async function installAddon(addonId = "canvas") {
  const id = String(addonId || "canvas");
  if (isTauriApp()) {
    if (id === "canvas") return tauriInvoke("install_canvas_addon");
    try {
      return await tauriInvoke("install_suite_addon", { addonId: id });
    } catch {
      const meta = catalogMeta(id);
      if (typeof window !== "undefined") {
        window.open(meta.installUrl || meta.repoUrl, "_blank", "noopener,noreferrer");
      }
      return { ok: true, mode: "browser", url: meta.installUrl };
    }
  }
  if (isElectronApp()) {
    if (id === "canvas" && window.electronAPI?.installCanvasAddon) {
      return window.electronAPI.installCanvasAddon();
    }
    if (window.electronAPI?.installSuiteAddon) {
      return window.electronAPI.installSuiteAddon(id);
    }
  }
  const meta = catalogMeta(id);
  if (typeof window !== "undefined") {
    window.open(meta.installUrl || meta.repoUrl, "_blank", "noopener,noreferrer");
    return { ok: true, mode: "browser", url: meta.installUrl };
  }
  return { ok: false, error: "Install requires the desktop app or a browser" };
}

export async function installCanvasAddon() {
  return installAddon("canvas");
}

/**
 * @param {string} [addonId]
 */
export async function launchAddon(addonId = "canvas") {
  const id = String(addonId || "canvas");
  if (isTauriApp()) {
    if (id === "canvas") return tauriInvoke("launch_canvas_addon");
    try {
      return await tauriInvoke("launch_suite_addon", { addonId: id });
    } catch {
      return { ok: false, error: `${catalogMeta(id).title} launch requires a desktop build with suite addon support` };
    }
  }
  if (isElectronApp()) {
    if (id === "canvas" && window.electronAPI?.launchCanvasAddon) {
      return window.electronAPI.launchCanvasAddon();
    }
    if (window.electronAPI?.launchSuiteAddon) {
      return window.electronAPI.launchSuiteAddon(id);
    }
  }
  return {
    ok: false,
    error: `Open ${catalogMeta(id).title} requires the desktop app (Tauri Studio or Electron)`,
  };
}

export async function launchCanvasAddon() {
  return launchAddon("canvas");
}

export function formatAddonInstallStatus(result, addonId = "canvas") {
  const title = catalogMeta(addonId).title;
  if (!result?.ok) return result?.error || result?.message || `Could not install ${title}`;
  if (result.message) return result.message;
  if (result.alreadyInstalled || result.mode === "installed") {
    return `${title} is already installed`;
  }
  if (result.mode === "local-installer") {
    return `Opened local ${title} installer — finish setup, then Open`;
  }
  if (result.mode === "downloaded") {
    return `Downloaded ${title} installer — finish setup, then Open`;
  }
  if (result.mode === "no-release") {
    return `No GitHub release yet — opened build instructions for ${title}`;
  }
  if (result.mode === "no-release-assets") {
    return `Release has no installer yet — opened ${title} instructions`;
  }
  if (result.mode === "docs" || result.mode === "browser") {
    return `Opened ${title} install instructions`;
  }
  return `${title} install started`;
}

export function formatCanvasInstallStatus(result) {
  return formatAddonInstallStatus(result, "canvas");
}
