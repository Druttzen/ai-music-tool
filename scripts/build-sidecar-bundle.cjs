#!/usr/bin/env node
/**
 * Cross-platform entry for PyInstaller sidecar bundle (Windows .ps1 / Unix .sh).
 * Skips rebuild when the host-triple binary already exists (safe for Tauri beforeBuildCommand).
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const binDir = path.join(root, "src-tauri", "binaries");

function hostTriple() {
  const r = spawnSync("rustc", ["-vV"], { encoding: "utf8" });
  if (r.status !== 0) return null;
  const m = r.stdout.match(/^host: (.+)$/m);
  return m ? m[1].trim() : null;
}

function expectedBinaryName(triple) {
  const base = `ai-sidecar-${triple}`;
  return triple.includes("windows") ? `${base}.exe` : base;
}

const triple = hostTriple();
if (triple && process.env.FORCE_SIDECAR_REBUILD !== "1") {
  const dest = path.join(binDir, expectedBinaryName(triple));
  if (fs.existsSync(dest)) {
    console.log(`Sidecar binary present (${path.basename(dest)}) — skip PyInstaller rebuild`);
    process.exit(0);
  }
}

const isWin = process.platform === "win32";
const script = path.join(__dirname, isWin ? "build-sidecar-bundle.ps1" : "build-sidecar-bundle.sh");

const result = isWin
  ? spawnSync(
      "powershell",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script],
      { stdio: "inherit", cwd: root },
    )
  : spawnSync("bash", [script], { stdio: "inherit", cwd: root });

process.exit(result.status ?? 1);
