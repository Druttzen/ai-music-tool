/**
 * Legacy Electron main process — **deprecated**. Primary desktop is Tauri (see docs/desktop.md).
 * Kept for existing Windows NSIS installs via `npm run dist`.
 */
const { app, BrowserWindow, shell, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const pkg = require("./package.json");

let mainWindow = null;

function createWindow() {
  const iconPath = path.join(__dirname, "icon.ico");
  const windowOptions = {
    title: `AI Music Creator v${pkg.version}`,
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: "#0b0d10",
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  };

  if (fs.existsSync(iconPath)) {
    windowOptions.icon = iconPath;
  }

  mainWindow = new BrowserWindow(windowOptions);

  mainWindow.loadFile(path.join(__dirname, "out", "index.html"));

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  openReadmeOnce();
}

function setupAutoUpdater() {
  if (!app.isPackaged) {
    // Register stubs so dev-Electron renderer invokes don't reject with "No handler".
    ipcMain.handle("app-check-for-updates", async () => ({
      ok: false,
      error: "Updates are only available in packaged builds.",
    }));
    ipcMain.handle("app-quit-and-install", () => {});
    return;
  }

  try {
    const { autoUpdater } = require("electron-updater");
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on("update-available", () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("app-update-status", { status: "available" });
      }
    });

    autoUpdater.on("update-downloaded", () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("app-update-status", {
          status: "downloaded",
          message: "Update ready — will install on quit, or restart now.",
        });
      }
    });

    autoUpdater.on("error", (err) => {
      console.warn("autoUpdater:", err?.message || err);
    });

    ipcMain.handle("app-check-for-updates", async () => {
      try {
        const result = await autoUpdater.checkForUpdates();
        return {
          ok: true,
          available: Boolean(result?.isUpdateAvailable),
          version: result?.isUpdateAvailable ? result.updateInfo?.version ?? null : null,
          currentVersion: app.getVersion(),
        };
      } catch (e) {
        return { ok: false, error: e?.message || "check failed" };
      }
    });

    ipcMain.handle("app-quit-and-install", () => {
      autoUpdater.quitAndInstall(false, true);
    });

    setTimeout(() => {
      autoUpdater.checkForUpdatesAndNotify().catch(() => {});
    }, 8000);
  } catch (e) {
    console.warn("electron-updater not available:", e?.message || e);
  }
}

function setupSuiteCanvasBridge() {
  const suiteBridge = require("./lib/suite-bridge.cjs");

  ipcMain.handle("suite:canvas-addon-status", async () => suiteBridge.canvasAddonStatus());

  ipcMain.handle("suite:launch-canvas-addon", async () => suiteBridge.launchCanvasAddon());

  ipcMain.handle("suite:install-canvas-addon", async () => {
    try {
      return await suiteBridge.installCanvasAddon();
    } catch (err) {
      return { ok: false, error: err?.message || "Failed to install Canvas addon" };
    }
  });

  ipcMain.handle("suite:open-canvas", async (_event, payload) => {
    try {
      const buffer = payload?.buffer;
      if (!buffer?.byteLength) {
        return { ok: false, error: "No image data" };
      }
      const artPath = await suiteBridge.writeArtworkExport(Buffer.from(buffer), payload?.ext);
      let audioPath;
      if (payload?.audioBuffer?.byteLength) {
        audioPath = await suiteBridge.writeAudioExport(
          Buffer.from(payload.audioBuffer),
          payload?.audioExt,
        );
      }
      const { exe, launched } = await suiteBridge.openInCanvasFromMusic({
        title: String(payload?.title || "Untitled Track"),
        artist: String(payload?.artist || "Unknown Artist"),
        albumArtPath: artPath,
        audioPath,
        motionHint: String(payload?.motionHint || "cinematic drift, 8 seconds"),
        durationSec: Number(payload?.durationSec) || 8,
      });
      if (!launched) {
        // Folder/file open is a fallback only — do not claim Canvas launched.
        await shell.openPath(suiteBridge.EXPORTS_DIR);
      }
      return { ok: true, launched, exe: exe || undefined };
    } catch (err) {
      return { ok: false, error: err?.message || "Failed to open Canvas Tool" };
    }
  });
}

function openReadmeOnce() {
  const flagPath = path.join(app.getPath("userData"), "readme-opened.flag");
  if (fs.existsSync(flagPath)) return;

  const possiblePaths = [
    path.join(process.resourcesPath, "AI_Music_Creator_README.pdf"),
    path.join(process.resourcesPath, "build", "AI_Music_Creator_README.pdf"),
    path.join(__dirname, "build", "AI_Music_Creator_README.pdf"),
    path.join(__dirname, "AI_Music_Creator_README.pdf"),
  ];

  const readmePath = possiblePaths.find((p) => fs.existsSync(p));
  if (!readmePath) return;

  setTimeout(() => {
    shell.openPath(readmePath);
    fs.writeFileSync(flagPath, "opened");
  }, 1500);
}

app.whenReady().then(() => {
  setupSuiteCanvasBridge();
  createWindow();
  setupAutoUpdater();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
