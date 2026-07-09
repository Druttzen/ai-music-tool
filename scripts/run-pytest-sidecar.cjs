#!/usr/bin/env node
/** Run ai-sidecar pytest suite (same filter as CI: -m "not slow"). */
const { spawnSync } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");
const sidecar = path.join(root, "ai-sidecar");
const isWin = process.platform === "win32";

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", cwd: opts.cwd || root, env: process.env, ...opts });
  if (r.status !== 0) process.exit(r.status ?? 1);
  return r;
}

function pythonExe() {
  const venvPy = path.join(sidecar, ".venv", isWin ? "Scripts/python.exe" : "bin/python");
  if (require("fs").existsSync(venvPy)) return venvPy;
  return isWin ? "python" : "python3";
}

const py = pythonExe();

run(py, ["-m", "pip", "install", "--upgrade", "pip"], { cwd: sidecar });
run(py, ["-m", "pip", "install", "-e", sidecar, "pytest", "httpx"], { cwd: root });
run(py, ["-m", "pytest", "ai-sidecar/tests", "-q", "-m", "not slow"], { cwd: root });
