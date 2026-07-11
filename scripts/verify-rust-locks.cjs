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

function reportCargoToolingFailure(relDir, stderr, status, message) {
  console.error(`\nFailed to run cargo in ${relDir}.`);
  console.error("Fix: ensure `cargo` is installed and available on your PATH.\n");
  if (message) console.error(message);
  if (stderr) process.stderr.write(stderr);
  process.exit(status ?? 1);
}

function reportLockDrift(relDir, stderr, status) {
  console.error(`\nCargo.lock is out of sync in ${relDir}.`);
  console.error("Fix: cd", relDir, "&& cargo build");
  console.error("Then commit the updated Cargo.lock.\n");
  if (stderr) process.stderr.write(stderr);
  process.exit(status ?? 1);
}

function verifyLocked(relDir, label) {
  const cwd = path.join(root, relDir);
  console.log(`verify-rust-locks — ${label} (${relDir})`);
  const r = spawnSync("cargo", ["metadata", "--locked", "--format-version", "1"], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "ignore", "pipe"],
    shell: process.platform === "win32",
  });

  if (r.status === 0) return;

  if (r.error) {
    reportCargoToolingFailure(relDir, r.stderr, 1, r.error.message);
  }

  const stderr = r.stderr || "";
  const lowerStderr = stderr.toLowerCase();
  const isToolingIssue =
    lowerStderr.includes("error: failed to run `cargo`") ||
    lowerStderr.includes("is not installed") ||
    lowerStderr.includes("could not execute process") ||
    lowerStderr.includes("not found") ||
    lowerStderr.includes("enoent");

  if (isToolingIssue) {
    reportCargoToolingFailure(relDir, stderr, r.status);
  }

  reportLockDrift(relDir, stderr, r.status);
}

for (const crate of crates) {
  verifyLocked(crate.dir, crate.label);
}

console.log("verify-rust-locks — OK");
