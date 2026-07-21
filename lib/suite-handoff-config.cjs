/** Shared Canvas handoff paths for Electron and Tauri. */
const fs = require("fs");
const path = require("path");
const os = require("os");

const config = require("./suite-handoff-paths.json");

function userHomeDir() {
  return process.env.HOME || process.env.USERPROFILE || os.homedir();
}

function suiteDir() {
  return path.join(userHomeDir(), ...config.suitePathFromHome);
}

function exportsDir() {
  return path.join(suiteDir(), config.exportsSubdir);
}

function handoffFile() {
  return path.join(suiteDir(), config.handoffFile);
}

function expandPathTemplate(template) {
  const env = process.env;
  return template
    .replace(/\$HOME/g, userHomeDir())
    .replace(/\$USERPROFILE/g, env.USERPROFILE || userHomeDir())
    .replace(/\$LOCALAPPDATA/g, env.LOCALAPPDATA || "")
    .replace(/\$ProgramFiles/g, env.ProgramFiles || "C:\\Program Files")
    .replace(/\//g, path.sep);
}

function platformKey() {
  if (process.platform === "win32") return "windows";
  if (process.platform === "darwin") return "macos";
  return "linux";
}

function canvasAddonMeta() {
  return config.canvas;
}

function canvasExecutableCandidates() {
  return (config.canvasCandidates?.[platformKey()] || []).map(expandPathTemplate).filter(Boolean);
}

function findCanvasExecutable() {
  return canvasExecutableCandidates().find((candidate) => fs.existsSync(candidate)) || null;
}

function canvasInstallerCandidates() {
  return (config.canvas?.installerCandidates?.[platformKey()] || [])
    .map(expandPathTemplate)
    .filter(Boolean);
}

function findCanvasInstaller() {
  return canvasInstallerCandidates().find((candidate) => fs.existsSync(candidate)) || null;
}

function canvasInstallFallbackUrl() {
  return config.canvas?.installUrl || config.canvas?.repoUrl || "https://github.com/Druttzen/ai-canvas-tool";
}

function handoffTimestampIso() {
  return new Date().toISOString();
}

function sanitizeArtworkExt(ext) {
  const raw = String(ext || "png").trim().replace(/^\.+/, "").toLowerCase();
  if (raw.includes("/") || raw.includes("\\") || raw.includes("..")) return "png";
  if (raw === "jpg" || raw === "jpeg") return "jpg";
  if (raw === "webp") return "webp";
  if (raw === "gif") return "gif";
  return "png";
}

module.exports = {
  config,
  userHomeDir,
  suiteDir,
  exportsDir,
  handoffFile,
  expandPathTemplate,
  canvasAddonMeta,
  canvasExecutableCandidates,
  findCanvasExecutable,
  canvasInstallFallbackUrl,
  canvasInstallerCandidates,
  findCanvasInstaller,
  handoffTimestampIso,
  sanitizeArtworkExt,
};
