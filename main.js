const { app, BrowserWindow, shell } = require("electron");
const path = require("path");
const fs = require("fs");

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    title: "AI Music Creator",
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: "#0b0d10",
    icon: path.join(__dirname, "icon.ico"),
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, "out", "index.html"));

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  openReadmeOnce();
}

function openReadmeOnce() {
  const flagPath = path.join(app.getPath("userData"), "readme-opened.flag");
  if (fs.existsSync(flagPath)) return;

  const possiblePaths = [
    path.join(process.resourcesPath, "AI_Music_Creator_README.pdf"),
    path.join(process.resourcesPath, "build", "AI_Music_Creator_README.pdf"),
    path.join(__dirname, "build", "AI_Music_Creator_README.pdf"),
    path.join(__dirname, "AI_Music_Creator_README.pdf")
  ];

  const readmePath = possiblePaths.find((p) => fs.existsSync(p));
  if (!readmePath) return;

  setTimeout(() => {
    shell.openPath(readmePath);
    fs.writeFileSync(flagPath, "opened");
  }, 1500);
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
