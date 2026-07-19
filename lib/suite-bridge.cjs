/**
 * AI Creator Suite — shared handoff protocol (Node/Electron legacy).
 */
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const {
  canvasExecutableCandidates,
  exportsDir,
  handoffFile,
  handoffTimestampIso,
  sanitizeArtworkExt,
  suiteDir,
} = require("./suite-handoff-config.cjs");

const SUITE_DIR = suiteDir();
const EXPORTS_DIR = exportsDir();
const HANDOFF_FILE = handoffFile();

async function ensureSuiteDirs() {
  await fs.promises.mkdir(EXPORTS_DIR, { recursive: true });
}

function findCanvasExecutable() {
  return canvasExecutableCandidates().find((p) => p && fs.existsSync(p)) || null;
}

/** @returns {string | null} executable path when spawn succeeded */
function launchCanvasTool() {
  const exe = findCanvasExecutable();
  if (!exe) return null;
  spawn(exe, ["--handoff", HANDOFF_FILE], { detached: true, stdio: "ignore" }).unref();
  return exe;
}

async function writeArtworkExport(buffer, ext) {
  await ensureSuiteDirs();
  const cleanExt = sanitizeArtworkExt(ext);
  const artPath = path.join(EXPORTS_DIR, `album-art-${Date.now()}.${cleanExt}`);
  await fs.promises.writeFile(artPath, buffer);
  return artPath;
}

/**
 * Write handoff.json and try to launch Canvas Tool.
 * @returns {{ exe: string | null, launched: boolean }}
 */
async function openInCanvasFromMusic({ title, artist, albumArtPath, motionHint, durationSec }) {
  await ensureSuiteDirs();
  const handoff = {
    version: 1,
    timestamp: handoffTimestampIso(),
    source: "ai-music-tool",
    track: { title, artist, albumArtPath },
    canvas: { motionHint, durationSec },
  };
  await fs.promises.writeFile(HANDOFF_FILE, JSON.stringify(handoff, null, 2), "utf8");
  const exe = launchCanvasTool();
  return { exe, launched: Boolean(exe) };
}

module.exports = {
  SUITE_DIR,
  EXPORTS_DIR,
  HANDOFF_FILE,
  ensureSuiteDirs,
  findCanvasExecutable,
  launchCanvasTool,
  writeArtworkExport,
  openInCanvasFromMusic,
};
