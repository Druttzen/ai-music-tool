/**
 * AI Creator Suite — shared handoff protocol (Node/Electron).
 * Used by ai-music-tool, ai-video-tool, and ai-canvas-tool.
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

const APP_IDS = {
  music: "ai-music-tool",
  video: "ai-video-tool",
  canvas: "ai-canvas-tool",
};

function ensureSuiteDirs() {
  fs.mkdirSync(EXPORTS_DIR, { recursive: true });
}

function writeHandoff(payload) {
  ensureSuiteDirs();
  const handoff = {
    version: 1,
    timestamp: new Date().toISOString(),
    ...payload,
  };
  fs.writeFileSync(HANDOFF_FILE, JSON.stringify(handoff, null, 2), "utf8");
  return handoff;
}

function readHandoff() {
  try {
    if (!fs.existsSync(HANDOFF_FILE)) return null;
    const data = JSON.parse(fs.readFileSync(HANDOFF_FILE, "utf8"));
    return data;
  } catch {
    return null;
  }
}

function clearHandoff() {
  try {
    if (fs.existsSync(HANDOFF_FILE)) fs.unlinkSync(HANDOFF_FILE);
  } catch {
    /* ignore */
  }
}

function findCanvasExecutable() {
  const candidates = [
    path.join(
      process.env.LOCALAPPDATA || "",
      "Programs",
      "ai-canvas-tool",
      "AI Canvas Tool.exe",
    ),
    path.join(
      process.env.LOCALAPPDATA || "",
      "Programs",
      "AI Canvas Tool",
      "AI Canvas Tool.exe",
    ),
    path.join(
      process.env["ProgramFiles"] || "C:\\Program Files",
      "AI Canvas Tool",
      "AI Canvas Tool.exe",
    ),
    path.join(
      process.env.USERPROFILE || "",
      "ai-canvas-tool",
      "release",
      "win-unpacked",
      "AI Canvas Tool.exe",
    ),
    path.join(
      process.env.USERPROFILE || "",
      "loopgif-studio",
      "release",
      "win-unpacked",
      "AI Canvas Tool.exe",
    ),
    path.join(
      process.env.USERPROFILE || "",
      "ai-suite",
      "ai-canvas-tool",
      "release",
      "win-unpacked",
      "AI Canvas Tool.exe",
    ),
  ];
  for (const p of candidates) {
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}

function launchCanvasTool(extraArgs = []) {
  const exe = findCanvasExecutable();
  if (!exe) {
    throw new Error(
      "AI Canvas Tool not found. Install it from ai-canvas-tool/release setup.",
    );
  }
  spawn(exe, ["--handoff", HANDOFF_FILE, ...extraArgs], {
    detached: true,
    stdio: "ignore",
  }).unref();
  return exe;
}

function openInCanvasFromMusic({ title, artist, albumArtPath, motionHint, durationSec }) {
  writeHandoff({
    source: APP_IDS.music,
    track: { title, artist, albumArtPath },
    canvas: { motionHint, durationSec },
  });
  return launchCanvasTool();
}

function openInCanvasFromVideo({ title, artist, clipPath, motionHint, durationSec }) {
  writeHandoff({
    source: APP_IDS.video,
    track: title ? { title, artist } : undefined,
    video: { clipPath },
    canvas: { motionHint, durationSec },
  });
  return launchCanvasTool();
}

module.exports = {
  SUITE_DIR,
  EXPORTS_DIR,
  HANDOFF_FILE,
  APP_IDS,
  ensureSuiteDirs,
  writeHandoff,
  readHandoff,
  clearHandoff,
  findCanvasExecutable,
  launchCanvasTool,
  openInCanvasFromMusic,
  openInCanvasFromVideo,
};
