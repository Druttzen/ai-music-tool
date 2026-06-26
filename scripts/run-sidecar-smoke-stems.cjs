#!/usr/bin/env node
/** Sidecar UI smoke with Demucs stems extra installed. */
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
    path.join(__dirname, "install-sidecar-stems.ps1"),
  ]);
  run("powershell", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    path.join(__dirname, "start-sidecar.ps1"),
    "-IdleExitSec",
    "0",
  ]);
} else {
  run("bash", [path.join(__dirname, "stop-sidecar.sh")]);
  run("bash", [path.join(__dirname, "install-sidecar-stems.sh")]);
  run("bash", [path.join(__dirname, "start-sidecar.sh"), "--idle-exit-sec", "0"]);
}

for (let i = 0; i < 60; i++) {
  try {
    const r = spawnSync(
      isWin ? "powershell" : "curl",
      isWin
        ? [
            "-NoProfile",
            "-Command",
            "(Invoke-WebRequest http://127.0.0.1:8723/health -UseBasicParsing -TimeoutSec 2).Content",
          ]
        : ["-sf", "http://127.0.0.1:8723/health"],
      { encoding: "utf8", cwd: root },
    );
    const body = r.stdout || "";
    if (r.status === 0 && body.includes('"stems_available":true')) break;
  } catch {
    /* retry */
  }
  spawnSync(isWin ? "powershell" : "sleep", isWin ? ["-Command", "Start-Sleep -Milliseconds 500"] : ["0.5"]);
}

run("npx", ["playwright", "test", "tests/e2e/sidecar-stems.spec.js"]);
