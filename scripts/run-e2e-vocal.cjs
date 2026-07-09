#!/usr/bin/env node
/** Run vocal / OpenVPI / Maestro vocal Playwright subset (needs sidecar with vocal extra). */
const { spawnSync } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");
const specs = [
  "tests/e2e/vocal-embed-smoke.spec.js",
  "tests/e2e/vocal-embed-align-synthesize.spec.js",
  "tests/e2e/project-bundle.spec.js",
  "tests/e2e/openvpi-ds-export.spec.js",
  "tests/e2e/openvpi-inference-ready.spec.js",
  "tests/e2e/coach-openvpi-ds.spec.js",
  "tests/e2e/coach-maestro-vocal-handoff.spec.js",
  "tests/e2e/maestro-vocal-embed.spec.js",
  "tests/e2e/maestro-vocal-embed-llm.spec.js",
];
const grep = "vocal align|OpenVPI|openvpi|Vocal Embed|Maestro|handoff|inference";

const r = spawnSync("npx", ["playwright", "test", ...specs, "--grep", grep], {
  stdio: "inherit",
  cwd: root,
  shell: process.platform === "win32",
});
process.exit(r.status ?? 1);
