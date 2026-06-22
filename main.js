const { app, BrowserWindow, shell, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const pkg = require("./package.json");
const suiteBridge = require("./lib/suite-bridge.cjs");

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
  if (!app.isPackaged) return;

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
        return { ok: true, version: result?.updateInfo?.version ?? null };
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
  ipcMain.handle("suite:open-canvas", async (_event, payload) => {
    try {
      const {
        title = "Untitled Track",
        artist = "Unknown Artist",
        buffer,
        ext = "png",
        motionHint = "cinematic drift, 8 seconds",
        durationSec = 8,
      } = payload || {};

      if (!buffer || !(buffer instanceof ArrayBuffer)) {
        return { ok: false, error: "Missing image data" };
      }

      suiteBridge.ensureSuiteDirs();
      const safeExt = String(ext).replace(/[^a-z0-9]/gi, "") || "png";
      const artPath = path.join(
        suiteBridge.EXPORTS_DIR,
        `artwork-handoff-${Date.now()}.${safeExt}`,
      );
      fs.writeFileSync(artPath, Buffer.from(buffer));

      const exe = suiteBridge.openInCanvasFromMusic({
        title,
        artist,
        albumArtPath: artPath,
        motionHint,
        durationSec,
      });

      return { ok: true, exe, artPath };
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
  createWindow();
  setupAutoUpdater();
  setupSuiteCanvasBridge();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
