const { app, BrowserWindow, shell, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
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

function resolveVideoCreatorExecutable() {
  const fromEnv = String(process.env.AI_VIDEO_CREATOR_EXE || "").trim();
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;

  const candidates = [
    path.join(__dirname, "..", "ai-video-tool", "electron-dist", "win-unpacked", "ai-video-tool.exe"),
    path.join(
      process.env.LOCALAPPDATA || "",
      "Programs",
      "ai-video-tool",
      "AI Video Creator.exe",
    ),
    path.join(process.env.ProgramFiles || "", "AI Video Creator", "ai-video-tool.exe"),
  ];
  return candidates.find((candidate) => candidate && fs.existsSync(candidate)) || null;
}

function setupVideoHandoffIpc() {
  ipcMain.handle("handoff:export-video", async (_event, payload) => {
    try {
      const bundleFileName = String(payload?.bundleFileName || "music-video.aivbundle.json");
      const { filePath, canceled } = await dialog.showSaveDialog({
        title: "Send to AI Video Creator",
        defaultPath: path.join(app.getPath("downloads"), bundleFileName),
        filters: [{ name: "Video handoff bundle", extensions: ["json"] }],
      });
      if (canceled || !filePath) return { ok: false, canceled: true };

      fs.writeFileSync(filePath, String(payload?.bundleJson || ""), "utf8");

      if (payload?.audioBuffer?.byteLength && payload?.audioFileName) {
        const audioPath = path.join(path.dirname(filePath), path.basename(String(payload.audioFileName)));
        fs.writeFileSync(audioPath, Buffer.from(payload.audioBuffer));
      }

      const videoExe = resolveVideoCreatorExecutable();
      let launched = false;
      if (videoExe) {
        try {
          spawn(videoExe, [filePath], { detached: true, stdio: "ignore", windowsHide: true }).unref();
          launched = true;
        } catch {
          launched = false;
        }
      }
      if (!launched) {
        await shell.openPath(filePath);
      }

      return { ok: true, path: filePath, launched };
    } catch (e) {
      return { ok: false, error: e?.message || "handoff export failed" };
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
  setupVideoHandoffIpc();
  createWindow();
  setupAutoUpdater();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
