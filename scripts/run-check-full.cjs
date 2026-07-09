#!/usr/bin/env node
/**
 * Full pre-release check: unit + lint + build + sidecar pytest.
 * Pass --e2e to restart sidecar and run the full Playwright suite (CI parity).
 */
const { spawnSync } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");
const withE2e = process.argv.includes("--e2e");
const isWin = process.platform === "win32";

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    stdio: "inherit",
    cwd: root,
    shell: isWin && (cmd === "npm" || cmd.endsWith(".cmd")),
    ...opts,
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

console.log("check:full — npm run check");
run("npm", ["run", "check"]);

console.log("check:full — sidecar pytest");
run(process.execPath, [path.join(__dirname, "run-pytest-sidecar.cjs")]);

if (withE2e) {
  console.log("check:full — Playwright e2e (sidecar smoke wrapper)");
  if (isWin) {
    run("powershell", [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      path.join(__dirname, "run-e2e-with-sidecar.ps1"),
    ]);
  } else {
    run("bash", [path.join(__dirname, "run-e2e-with-sidecar.sh")]);
  }
}

console.log("check:full — OK");
