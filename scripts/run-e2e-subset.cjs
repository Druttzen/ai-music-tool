#!/usr/bin/env node
/** Fast Playwright subset for release gate (Maestro + MusicGen + OpenVPI coach smoke). */
const { spawnSync } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");
const specs = [
  "tests/e2e/musicgen-merge.spec.js",
  "tests/e2e/openvpi-ds-export.spec.js",
  "tests/e2e/maestro-offline.spec.js",
  "tests/e2e/maestro-coach-musicgen.spec.js",
  "tests/e2e/coach-openvpi-ds.spec.js",
  "tests/e2e/coach-maestro-vocal-handoff.spec.js",
];

const r = spawnSync("npx", ["playwright", "test", ...specs, "--workers=1"], {
  stdio: "inherit",
  cwd: root,
  shell: process.platform === "win32",
});
process.exit(r.status ?? 1);
