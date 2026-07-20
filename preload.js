const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  checkForUpdates: () => ipcRenderer.invoke("app-check-for-updates"),
  quitAndInstall: () => ipcRenderer.invoke("app-quit-and-install"),
  onUpdateStatus: (callback) => {
    if (typeof callback !== "function") return () => {};
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on("app-update-status", handler);
    return () => ipcRenderer.removeListener("app-update-status", handler);
  },
  exportVideoHandoff: (payload) => ipcRenderer.invoke("handoff:export-video", payload),
  openInCanvasTool: (payload) => ipcRenderer.invoke("suite:open-canvas", payload),
  canvasAddonStatus: () => ipcRenderer.invoke("suite:canvas-addon-status"),
  launchCanvasAddon: () => ipcRenderer.invoke("suite:launch-canvas-addon"),
  installCanvasAddon: () => ipcRenderer.invoke("suite:install-canvas-addon"),
  suiteAddonStatus: (addonId) => ipcRenderer.invoke("suite:addon-status", addonId),
  installSuiteAddon: (addonId) => ipcRenderer.invoke("suite:install-addon", addonId),
  launchSuiteAddon: (addonId) => ipcRenderer.invoke("suite:launch-addon", addonId),
  exportMusicVideoHandoff: (payload) => ipcRenderer.invoke("suite:export-music-video-handoff", payload),
});
