#!/usr/bin/env node
/**
 * Fail fast when Cargo.lock is out of sync with Cargo.toml (CI tauri-smoke / dsp-core use --locked).
 */
const { spawnSync } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");
const crates = [
  { dir: "dsp-core", label: "dsp-core" },
  { dir: "src-tauri", label: "Tauri shell" },
];

function verifyLocked(relDir, label) {
  const cwd = path.join(root, relDir);
  console.log(`verify-rust-locks — ${label} (${relDir})`);
  const r = spawnSync("cargo", ["metadata", "--locked", "--format-version", "1"], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "ignore", "pipe"],
    shell: process.platform === "win32",
  });
  if (r.status !== 0) {
    console.error(`\nCargo.lock is out of sync in ${relDir}.`);
    console.error("Fix: cd", relDir, "&& cargo build");
    console.error("Then commit the updated Cargo.lock.\n");
    if (r.stderr) process.stderr.write(r.stderr);
    process.exit(r.status ?? 1);
  }
}

for (const crate of crates) {
  verifyLocked(crate.dir, crate.label);
}

console.log("verify-rust-locks — OK");
