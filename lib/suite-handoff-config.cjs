/**
 * Shared AI Suite handoff paths — single source for Electron and Tauri.
 */
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

function canvasPlatformKey() {
  if (process.platform === "win32") return "windows";
  if (process.platform === "darwin") return "macos";
  return "linux";
}

function canvasExecutableCandidates() {
  const list = config.canvasCandidates[canvasPlatformKey()] || [];
  return list.map(expandPathTemplate).filter(Boolean);
}

function findCanvasExecutable() {
  return canvasExecutableCandidates().find((p) => p && fs.existsSync(p)) || null;
}

function canvasAddonMeta() {
  return config.addons?.canvas || null;
}

function canvasInstallerCandidates() {
  const list = canvasAddonMeta()?.installerCandidates?.[canvasPlatformKey()] || [];
  return list.map(expandPathTemplate).filter(Boolean);
}

function findCanvasInstaller() {
  return canvasInstallerCandidates().find((p) => p && fs.existsSync(p)) || null;
}

function handoffTimestampIso() {
  return new Date().toISOString();
}

/**
 * Whitelist artwork export extensions (mirrors src-tauri canvas_handoff sanitize_ext).
 * Rejects path separators / traversal by falling through to png.
 * @param {string | null | undefined} ext
 * @returns {"jpg" | "webp" | "gif" | "png"}
 */
function sanitizeArtworkExt(ext) {
  const raw = String(ext || "png")
    .trim()
    .replace(/^\.+/, "")
    .toLowerCase();
  if (raw.includes("/") || raw.includes("\\") || raw.includes("..")) {
    return "png";
  }
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
  canvasExecutableCandidates,
  findCanvasExecutable,
  canvasAddonMeta,
  canvasInstallerCandidates,
  findCanvasInstaller,
  handoffTimestampIso,
  sanitizeArtworkExt,
};
