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

function listAddonIds() {
  return Object.keys(config.addons || {});
}

function addonMeta(addonId) {
  return config.addons?.[addonId] || null;
}

function canvasAddonMeta() {
  return addonMeta("canvas");
}

function executableCandidatesForAddon(addonId) {
  const meta = addonMeta(addonId);
  const platform = canvasPlatformKey();
  if (addonId === "canvas") {
    const list = config.canvasCandidates?.[platform] || [];
    return list.map(expandPathTemplate).filter(Boolean);
  }
  const list = meta?.executableCandidates?.[platform] || [];
  return list.map(expandPathTemplate).filter(Boolean);
}

function findAddonExecutable(addonId) {
  return executableCandidatesForAddon(addonId).find((p) => p && fs.existsSync(p)) || null;
}

function canvasExecutableCandidates() {
  return executableCandidatesForAddon("canvas");
}

function findCanvasExecutable() {
  return findAddonExecutable("canvas");
}

function canvasInstallFallbackUrl() {
  const meta = canvasAddonMeta();
  return meta?.installUrl || meta?.repoUrl || "https://github.com/Druttzen/ai-canvas-tool";
}

function addonInstallFallbackUrl(addonId) {
  const meta = addonMeta(addonId);
  return meta?.installUrl || meta?.repoUrl || canvasInstallFallbackUrl();
}

function installerCandidatesForAddon(addonId) {
  const list = addonMeta(addonId)?.installerCandidates?.[canvasPlatformKey()] || [];
  return list.map(expandPathTemplate).filter(Boolean);
}

function findAddonInstaller(addonId) {
  return installerCandidatesForAddon(addonId).find((p) => p && fs.existsSync(p)) || null;
}

function canvasInstallerCandidates() {
  return installerCandidatesForAddon("canvas");
}

function findCanvasInstaller() {
  return findAddonInstaller("canvas");
}

function musicVideoExportsDir() {
  return path.join(exportsDir(), "music-video");
}

function musicVideoHandoffFile() {
  return path.join(musicVideoExportsDir(), "music-video-handoff.json");
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
  canvasPlatformKey,
  listAddonIds,
  addonMeta,
  canvasExecutableCandidates,
  findCanvasExecutable,
  findAddonExecutable,
  executableCandidatesForAddon,
  canvasAddonMeta,
  canvasInstallFallbackUrl,
  addonInstallFallbackUrl,
  canvasInstallerCandidates,
  findCanvasInstaller,
  installerCandidatesForAddon,
  findAddonInstaller,
  musicVideoExportsDir,
  musicVideoHandoffFile,
  handoffTimestampIso,
  sanitizeArtworkExt,
};
