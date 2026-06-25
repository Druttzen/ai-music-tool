#!/usr/bin/env node
/** Cross-platform sidecar UI smoke: restart sidecar, wait for /health, run Playwright spec. */
const { spawnSync } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");
const isWin = process.platform === "win32";

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", cwd: root, ...opts });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

if (isWin) {
  run("powershell", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    path.join(__dirname, "stop-sidecar.ps1"),
  ]);
  run("powershell", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    path.join(__dirname, "start-sidecar.ps1"),
  ]);
} else {
  run("bash", [path.join(__dirname, "stop-sidecar.sh")]);
  run("bash", [path.join(__dirname, "start-sidecar.sh")]);
}

for (let i = 0; i < 40; i++) {
  try {
    const r = spawnSync(
      isWin ? "powershell" : "curl",
      isWin
        ? [
            "-NoProfile",
            "-Command",
            "(Invoke-WebRequest http://127.0.0.1:8723/health -UseBasicParsing -TimeoutSec 2).StatusCode",
          ]
        : ["-sf", "http://127.0.0.1:8723/health"],
      { encoding: "utf8", cwd: root },
    );
    if (r.status === 0) break;
  } catch {
    /* retry */
  }
  spawnSync(isWin ? "powershell" : "sleep", isWin ? ["-Command", "Start-Sleep -Milliseconds 500"] : ["0.5"]);
}

run("npx", ["playwright", "test", "tests/e2e/sidecar-smoke.spec.js"]);
