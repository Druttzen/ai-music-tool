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

/** True when Tauri Studio can run native Canvas install/launch. */
export function isDesktopAddonHost() {
  return isTauriApp();
}

export async function getCanvasAddonStatus() {
  if (isTauriApp()) return tauriInvoke("suite_canvas_addon_status");
  return {
    ...CANVAS_ADDON,
    installed: false,
    path: null,
    uninstallerPath: null,
    desktop: false,
  };
}

export async function installCanvasAddon() {
  if (isTauriApp()) return tauriInvoke("install_canvas_addon");
  return {
    ok: false,
    mode: "desktop-required",
    error: CANVAS_DESKTOP_REQUIRED,
  };
}

export async function launchCanvasAddon() {
  if (isTauriApp()) return tauriInvoke("launch_canvas_addon");
  return { ok: false, error: CANVAS_DESKTOP_REQUIRED };
}

export async function uninstallCanvasAddon() {
  if (isTauriApp()) return tauriInvoke("uninstall_canvas_addon");
  return { ok: false, error: CANVAS_DESKTOP_REQUIRED };
}

export function formatCanvasInstallStatus(result) {
  if (!result?.ok) {
    if (result?.mode === "desktop-required") return CANVAS_DESKTOP_REQUIRED;
    if (result?.mode === "download-failed") {
      const base = result.error || result.message || "Could not download Canvas installer from GitHub";
      return result.url ? `${base} — ${result.url}` : base;
    }
    return result?.error || result?.message || "Could not install AI Canvas Tool";
  }
  if (result.message) return result.message;
  if (result.alreadyInstalled || result.mode === "installed") return "AI Canvas Tool is already installed";
  if (result.mode === "local-installer") return "Opened local Canvas installer — finish setup, then Open";
  if (result.mode === "install-failed") {
    return (
      result.error ||
      "Canvas silent install into Studio app data failed — retry Install"
    );
  }
  if (result.mode === "downloaded") return "Downloaded Canvas installer — finish setup, then Open";
  if (result.mode === "updated") return "AI Canvas Tool updated";
  if (result.mode === "uninstall-launched") return "Canvas uninstall app opened";
  if (result.mode === "uninstaller-missing") return "Canvas uninstall app was not found";
  if (result.mode === "uninstall-failed") {
    return result.error || "Could not open the Canvas uninstall app";
  }
  if (result.mode === "no-release") return "Could not find a latest Canvas release — opened releases page";
  if (result.mode === "no-release-assets") return "Release has no installer assets — opened Canvas releases page";
  if (result.mode === "docs" || result.mode === "browser") return "Opened Canvas install instructions";
  return "Canvas install started";
}
