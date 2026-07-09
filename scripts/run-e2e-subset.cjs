#!/usr/bin/env node
/** Fast Playwright subset for release gate (base sidecar only — no generate/vocal extras). */
const { spawnSync } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");
const specs = [
  "tests/e2e/musicgen-merge.spec.js",
  "tests/e2e/openvpi-ds-export.spec.js",
];

const r = spawnSync("npx", ["playwright", "test", ...specs, "--workers=1"], {
  stdio: "inherit",
  cwd: root,
  shell: process.platform === "win32",
});
process.exit(r.status ?? 1);
