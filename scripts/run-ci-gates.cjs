#!/usr/bin/env node
/**
 * Local CI parity gate — run before push to catch the failures that break GitHub Actions most often.
 *
 * Always: npm run check:full + verify-rust-locks
 * Optional: --e2e-subset (Playwright release subset + sidecar)
 */
const { spawnSync } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");
const withE2eSubset = process.argv.includes("--e2e-subset");
const isWin = process.platform === "win32";

function run(label, cmd, args) {
  console.log(`\nci-gates — ${label}`);
  const r = spawnSync(cmd, args, {
    stdio: "inherit",
    cwd: root,
    shell: isWin && (cmd === "npm" || cmd === "cargo" || cmd.endsWith(".cmd")),
  });
  if (r.status !== 0) {
    console.error(`\nci-gates — FAILED at: ${label}`);
    process.exit(r.status ?? 1);
  }
}

run("check:full", "npm", ["run", "check:full"]);
run("rust lockfiles", process.execPath, [path.join(__dirname, "verify-rust-locks.cjs")]);

if (withE2eSubset) {
  run("e2e subset", "npm", ["run", "test:e2e:subset"]);
}

console.log("\nci-gates — OK (matches core CI check + rust-locks jobs)");
