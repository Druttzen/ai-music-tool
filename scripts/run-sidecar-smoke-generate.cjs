#!/usr/bin/env node
/** Optional MusicGen smoke — skips unless sidecar reports generate_available. */
const { spawnSync } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");
const isWin = process.platform === "win32";

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", cwd: root, ...opts });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

function probeHealth() {
  const probe = spawnSync(
    isWin ? "powershell" : "curl",
    isWin
      ? [
          "-NoProfile",
          "-Command",
          "(Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8723/health).Content",
        ]
      : ["-sf", "http://127.0.0.1:8723/health"],
    { cwd: root, encoding: "utf8" },
  );
  if (probe.status !== 0 && !probe.stdout) return null;
  try {
    return JSON.parse(probe.stdout);
  } catch {
    return null;
  }
}

if (isWin) {
  run("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(__dirname, "start-sidecar.ps1")]);
} else {
  run("bash", [path.join(__dirname, "start-sidecar.sh")]);
}

const deadline = Date.now() + 30_000;
let health = null;
while (Date.now() < deadline) {
  health = probeHealth();
  if (health) break;
  spawnSync(isWin ? "powershell" : "sleep", isWin ? ["-Command", "Start-Sleep -Milliseconds 500"] : ["0.5"]);
}

if (!health) {
  console.error("Sidecar did not become ready on :8723");
  process.exit(1);
}

if (!health.generate_available) {
  console.log("SKIP: MusicGen extra not installed (npm run sidecar:generate)");
  process.exit(0);
}

const gen = spawnSync(
  isWin ? "powershell" : "curl",
  isWin
    ? [
        "-NoProfile",
        "-Command",
        "$b = @{ prompt='dark techno loop test'; duration_sec=3 } | ConvertTo-Json; Invoke-WebRequest -UseBasicParsing -Method POST -Uri http://127.0.0.1:8723/generate -ContentType 'application/json' -Body $b -OutFile $env:TEMP\\musicgen-smoke.wav; if ((Get-Item $env:TEMP\\musicgen-smoke.wav).Length -gt 1000) { 'ok' }",
      ]
    : [
        "-sf",
        "-X",
        "POST",
        "http://127.0.0.1:8723/generate",
        "-H",
        "Content-Type: application/json",
        "-d",
        '{"prompt":"dark techno loop test","duration_sec":3}',
        "-o",
        "/tmp/musicgen-smoke.wav",
      ],
  { cwd: root, encoding: "utf8" },
);

if (gen.status !== 0) {
  console.error("MusicGen /generate smoke failed");
  process.exit(1);
}

console.log("MusicGen smoke OK");
