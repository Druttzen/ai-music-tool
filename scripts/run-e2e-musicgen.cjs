#!/usr/bin/env node
/** Run MusicGen Playwright subset. Pass --live for generate-extra live specs. */
const { spawnSync } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");
const live = process.argv.includes("--live");

const specs = [
  "tests/e2e/musicgen-merge.spec.js",
  "tests/e2e/maestro-coach-musicgen.spec.js",
];
if (live) {
  specs.push(
    "tests/e2e/musicgen-live.spec.js",
    "tests/e2e/musicgen-melody.spec.js",
    "tests/e2e/musicgen-highlight-melody.spec.js",
  );
}

const r = spawnSync("npx", ["playwright", "test", ...specs], {
  stdio: "inherit",
  cwd: root,
  shell: process.platform === "win32",
});
process.exit(r.status ?? 1);
