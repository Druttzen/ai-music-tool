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

/** True when cargo never ran (missing binary) vs returned a lock resolution error. */
function isCargoToolingIssue(r) {
  if (r.error) return true;
  if (r.status == null) return true;
  const stderr = (r.stderr || "").toLowerCase();
  return (
    stderr.includes("error: failed to run `cargo`") ||
    stderr.includes("program not found") ||
    stderr.includes("could not execute process") ||
    stderr.includes("is not recognized as an internal or external command") ||
    stderr.includes("'cargo' is not recognized")
  );
}

function isLockDriftIssue(r) {
  const stderr = (r.stderr || "").toLowerCase();
  return (
    stderr.includes("cannot update the lock file") ||
    stderr.includes("--locked was passed") ||
    stderr.includes("lock file needs to be updated")
  );
}

function reportCargoFailure(kind, relDir, stderr, status, message) {
  if (kind === "tooling") {
    console.error(`\nFailed to run cargo in ${relDir}.`);
    console.error("Fix: ensure `cargo` is installed and available on your PATH.\n");
    if (message) console.error(message);
  } else {
    console.error(`\nCargo.lock is out of sync in ${relDir}.`);
    console.error("Fix: cd", relDir, "&& cargo build");
    console.error("Then commit the updated Cargo.lock.\n");
  }
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

  const stderr = r.stderr || "";
  let kind = "lock_drift";
  if (isCargoToolingIssue(r)) {
    kind = "tooling";
  } else if (!isLockDriftIssue(r)) {
    // Unknown cargo failure — show stderr without guessing lock drift.
    console.error(`\nUnexpected cargo failure in ${relDir}.`);
    if (stderr) process.stderr.write(stderr);
    process.exit(r.status ?? 1);
  }

  reportCargoFailure(kind, relDir, stderr, r.status ?? 1, r.error?.message);
}

for (const crate of crates) {
  verifyLocked(crate.dir, crate.label);
}

console.log("verify-rust-locks — OK");
