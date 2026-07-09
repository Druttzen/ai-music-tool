#!/usr/bin/env node
/** Cross-platform Vocal Embed smoke: sidecar up, Playwright vocal embed spec. */
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

const deadline = Date.now() + 30_000;
let ready = false;
while (Date.now() < deadline) {
  const probe = spawnSync(
    isWin ? "powershell" : "curl",
    isWin
      ? [
          "-NoProfile",
          "-Command",
          "try { (Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8723/health).StatusCode -eq 200 } catch { $false }",
        ]
      : ["-sf", "http://127.0.0.1:8723/health"],
    { cwd: root, encoding: "utf8" },
  );
  const out = `${probe.stdout || ""}`.trim();
  if (probe.status === 0 || out === "True") {
    ready = true;
    break;
  }
  spawnSync(isWin ? "powershell" : "sleep", isWin ? ["-Command", "Start-Sleep -Milliseconds 500"] : ["0.5"]);
}

if (!ready) {
  console.error("Sidecar did not become ready on :8723");
  process.exit(1);
}

run("npx", [
  "playwright",
  "test",
  "tests/e2e/vocal-embed-smoke.spec.js",
  "tests/e2e/vocal-embed-align-synthesize.spec.js",
]);
