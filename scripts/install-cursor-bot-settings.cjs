#!/usr/bin/env node
/**
 * One-shot setup: git pre-push hook + Sourcery + Fail-safe Cursor rules.
 */
const { spawnSync } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");
const isWin = process.platform === "win32";

function run(script) {
  const r = spawnSync(process.execPath, [path.join(__dirname, script)], {
    cwd: root,
    stdio: "inherit",
    shell: false,
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

console.log("bots:install — git hooks + Cursor bot rules\n");
run("install-git-hooks.cjs");
run("install-sourcery-cursor-setting.cjs");
run("install-fail-safe-cursor-setting.cjs");
run("install-architecture-cursor-setting.cjs");
console.log("\nbots:install — OK");
console.log("  Pre-push: npm run check:ci (FAIL_SAFE_PRE_PUSH=1 → npm run fail-safe:run)");
console.log("  Before push: npm run fail-safe:run");
console.log("  Sourcery PR: npm run sourcery:auto");
console.log("  Architecture: docs/architecture-convergence.md");
