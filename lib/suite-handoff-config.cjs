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

function handoffTimestampIso() {
  return new Date().toISOString();
}

module.exports = {
  config,
  userHomeDir,
  suiteDir,
  exportsDir,
  handoffFile,
  expandPathTemplate,
  canvasExecutableCandidates,
  handoffTimestampIso,
};
