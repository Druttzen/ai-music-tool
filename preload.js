/**
 * Archived Electron preload — packaging retired after studio-v0.50.21.
 * Do not revive Electron IPC; Studio uses Tauri commands (docs/desktop.md).
 */

contextBridge.exposeInMainWorld("electronAPI", {
  checkForUpdates: () => ipcRenderer.invoke("app-check-for-updates"),
  quitAndInstall: () => ipcRenderer.invoke("app-quit-and-install"),
  onUpdateStatus: (callback) => {
    if (typeof callback !== "function") return () => {};
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on("app-update-status", handler);
    return () => ipcRenderer.removeListener("app-update-status", handler);
  },
  openInCanvasTool: (payload) => ipcRenderer.invoke("suite:open-canvas", payload),
  canvasAddonStatus: () => ipcRenderer.invoke("suite:canvas-addon-status"),
  launchCanvasAddon: () => ipcRenderer.invoke("suite:launch-canvas-addon"),
  installCanvasAddon: () => ipcRenderer.invoke("suite:install-canvas-addon"),
  installSidecarExtra: (extraId) => ipcRenderer.invoke("suite:install-sidecar-extra", extraId),
  probeSidecarExtraInstallEnv: () => ipcRenderer.invoke("suite:probe-sidecar-extra-install-env"),
});
