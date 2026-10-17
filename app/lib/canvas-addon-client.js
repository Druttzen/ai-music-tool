import { runProcess } from "./process-status";

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
  "Activates the internal Canvas sidecar plugin inside Studio.";

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
  return runProcess("Install Canvas", async () => {
    if (isTauriApp()) return tauriInvoke("install_canvas_addon");
    return {
      ok: false,
      mode: "desktop-required",
      error: CANVAS_DESKTOP_REQUIRED,
    };
  });
}

export async function launchCanvasAddon() {
  return runProcess("Open Canvas", async () => {
    if (isTauriApp()) return tauriInvoke("launch_canvas_addon");
    return { ok: false, error: CANVAS_DESKTOP_REQUIRED };
  });
}

export async function uninstallCanvasAddon() {
  return runProcess("Disable Canvas", async () => {
    if (isTauriApp()) return tauriInvoke("uninstall_canvas_addon");
    return { ok: false, error: CANVAS_DESKTOP_REQUIRED };
  });
}

export function formatCanvasInstallStatus(result) {
  if (!result?.ok) {
    if (result?.mode === "desktop-required") return CANVAS_DESKTOP_REQUIRED;
    if (result?.mode === "download-failed") {
      const base = result.error || result.message || "Could not download Canvas installer from GitHub";
      return result.url ? `${base} — ${result.url}` : base;
    }
    return result?.error || result?.message || "Could not activate the internal Canvas plugin";
  }
  if (result.message) return result.message;
  if (result.mode === "uninstalled") return "Internal Canvas plugin deactivated";
  if (result.mode === "installed") return "Internal Canvas plugin is installed";
  if (result.mode === "updated") return "Internal Canvas plugin updated";
  if (result.mode === "internal-panel") return "Canvas opened inside Studio";
  return "Internal Canvas plugin ready";
}
