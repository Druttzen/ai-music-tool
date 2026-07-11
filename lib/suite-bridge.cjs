/**
 * AI Creator Suite — shared handoff protocol (Node/Electron legacy).
 */
const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawn } = require("child_process");

const SUITE_DIR = path.join(
  process.env.USERPROFILE || os.homedir(),
  "Documents",
  "AI Suite",
);
const EXPORTS_DIR = path.join(SUITE_DIR, "exports");
const HANDOFF_FILE = path.join(SUITE_DIR, "handoff.json");

function ensureSuiteDirs() {
  fs.mkdirSync(EXPORTS_DIR, { recursive: true });
}

function findCanvasExecutable() {
  const candidates = [
    path.join(process.env.LOCALAPPDATA || "", "Programs", "ai-canvas-tool", "AI Canvas Tool.exe"),
    path.join(process.env.LOCALAPPDATA || "", "Programs", "AI Canvas Tool", "AI Canvas Tool.exe"),
    path.join(process.env.ProgramFiles || "C:\\Program Files", "AI Canvas Tool", "AI Canvas Tool.exe"),
    path.join(process.env.USERPROFILE || "", "ai-canvas-tool", "release", "win-unpacked", "AI Canvas Tool.exe"),
    path.join(
      process.env.USERPROFILE || "",
      "ai-suite",
      "ai-canvas-tool",
      "release",
      "win-unpacked",
      "AI Canvas Tool.exe",
    ),
  ];
  return candidates.find((p) => p && fs.existsSync(p)) || null;
}

function launchCanvasTool() {
  const exe = findCanvasExecutable();
  if (!exe) {
    throw new Error("AI Canvas Tool not found. Install it from ai-canvas-tool/release setup.");
  }
  spawn(exe, ["--handoff", HANDOFF_FILE], { detached: true, stdio: "ignore" }).unref();
  return exe;
}

function openInCanvasFromMusic({ title, artist, albumArtPath, motionHint, durationSec }) {
  ensureSuiteDirs();
  const handoff = {
    version: 1,
    timestamp: new Date().toISOString(),
    source: "ai-music-tool",
    track: { title, artist, albumArtPath },
    canvas: { motionHint, durationSec },
  };
  fs.writeFileSync(HANDOFF_FILE, JSON.stringify(handoff, null, 2), "utf8");
  return launchCanvasTool();
}

module.exports = {
  SUITE_DIR,
  EXPORTS_DIR,
  HANDOFF_FILE,
  ensureSuiteDirs,
  findCanvasExecutable,
  launchCanvasTool,
  openInCanvasFromMusic,
};
