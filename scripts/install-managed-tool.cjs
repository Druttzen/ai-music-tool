#!/usr/bin/env node
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const tool = process.argv[2];
if (!["mfa", "diffsinger", "java", "ffmpeg"].includes(tool)) {
  console.error("Unknown managed tool");
  process.exit(1);
}
const windows = process.platform === "win32";
const script = path.join(__dirname, `install-sidecar-${tool}.${windows ? "ps1" : "sh"}`);
const args = windows ? ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script] : [script];
const result = spawnSync(windows ? "powershell" : "bash", args, { stdio: "inherit", shell: false });
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
