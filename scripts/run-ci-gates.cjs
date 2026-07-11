#!/usr/bin/env node
/**
 * Local CI parity gate — run before push to catch the failures that break GitHub Actions most often.
 *
 * Always: npm run check:full (includes rust lockfile verify)
 * Optional: --e2e-subset (Playwright release subset + sidecar)
 */
const { spawnSync } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");
const withE2eSubset = process.argv.includes("--e2e-subset");
const isWin = process.platform === "win32";

function fail(label, status) {
  console.error(`\nci-gates — FAILED at: ${label}`);
  process.exit(status ?? 1);
}

function runNpm(args, label) {
  console.log(`\nci-gates — ${label}`);
  const r = spawnSync("npm", args, {
    stdio: "inherit",
    cwd: root,
    shell: isWin,
  });
  if (r.status !== 0) fail(label, r.status);
}

runNpm(["run", "check:full"], "check:full");

if (withE2eSubset) {
  runNpm(["run", "test:e2e:subset"], "e2e subset");
}

console.log("\nci-gates — OK (matches core CI check job)");
