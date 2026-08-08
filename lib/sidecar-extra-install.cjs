/**
 * Electron maintenance path: run scripts/install-sidecar-*.ps1|.sh when venv exists.
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SIDECAR = path.join(ROOT, "ai-sidecar");

const SCRIPT_STEM = {
  stems: "install-sidecar-stems",
  generate: "install-sidecar-generate",
  classify: "install-sidecar-classify",
  vision: "install-sidecar-vision",
  cover: "install-sidecar-cover",
  "cover-ref": "install-sidecar-cover-ref",
  vocal: "install-sidecar-vocal",
  "vocal-rvc": "install-sidecar-vocal-rvc",
};

function venvPython() {
  const win = path.join(SIDECAR, ".venv", "Scripts", "python.exe");
  const nix = path.join(SIDECAR, ".venv", "bin", "python");
  if (fs.existsSync(win)) return win;
  if (fs.existsSync(nix)) return nix;
  return null;
}

function resolveScript(stem) {
  const ps1 = path.join(ROOT, "scripts", `${stem}.ps1`);
  const sh = path.join(ROOT, "scripts", `${stem}.sh`);
  if (process.platform === "win32" && fs.existsSync(ps1)) return { kind: "ps1", file: ps1 };
  if (fs.existsSync(sh)) return { kind: "sh", file: sh };
  if (fs.existsSync(ps1)) return { kind: "ps1", file: ps1 };
  return null;
}

function runScript(stem, timeoutMs = 120_000) {
  const script = resolveScript(stem);
  if (!script) return { ok: false, error: `Script missing: ${stem}` };
  const r =
    script.kind === "ps1"
      ? spawnSync(
          "powershell",
          ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script.file],
          { cwd: ROOT, encoding: "utf8", maxBuffer: 8 * 1024 * 1024, timeout: timeoutMs },
        )
      : spawnSync("bash", [script.file], {
          cwd: ROOT,
          encoding: "utf8",
          maxBuffer: 8 * 1024 * 1024,
          timeout: timeoutMs,
        });
  if (r.error) return { ok: false, error: r.error.message };
  if (r.status !== 0) {
    const out = `${r.stdout || ""}${r.stderr || ""}`.trim();
    return { ok: false, error: out || `exit ${r.status}` };
  }
  return { ok: true };
}

function sleepSync(ms) {
  const sab = new SharedArrayBuffer(4);
  const view = new Int32Array(sab);
  Atomics.wait(view, 0, 0, ms);
}

function probeHealthOnce() {
  const r = spawnSync(
    process.execPath,
    [
      "-e",
      "require('http').get('http://127.0.0.1:8723/health',(res)=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>process.exit(res.statusCode===200?0:1))}).on('error',()=>process.exit(1));setTimeout(()=>process.exit(1),2000)",
    ],
    { encoding: "utf8", timeout: 4000 },
  );
  return r.status === 0;
}

function waitForHealth(timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (probeHealthOnce()) return true;
    sleepSync(750);
  }
  return false;
}

/** Stop then start local sidecar via existing scripts (dev Electron path). */
function softRestartSidecar() {
  runScript("stop-sidecar", 30_000);
  const start = runScript("start-sidecar", 60_000);
  if (!start.ok) {
    return { ok: false, detail: start.error || "start failed" };
  }
  const ready = waitForHealth(20_000);
  return { ok: ready, detail: ready ? "ready" : "started but /health not ready yet" };
}

function installSidecarExtra(extraId) {
  const id = String(extraId || "").trim();
  const hint = `npm run sidecar:${id}`;
  const stem = SCRIPT_STEM[id];
  if (!stem) {
    return { ok: false, extraId: id, mode: "unknown", error: "Unknown sidecar extra id", installHint: hint };
  }
  if (!fs.existsSync(path.join(SIDECAR, "ai_sidecar", "main.py"))) {
    return {
      ok: false,
      extraId: id,
      mode: "bundled-readonly",
      error: "ai-sidecar source not found — pip extras need a local checkout with .venv",
      installHint: hint,
    };
  }
  if (!venvPython()) {
    return {
      ok: false,
      extraId: id,
      mode: "bundled-readonly",
      error:
        "No writable ai-sidecar/.venv — packaged Studio cannot pip-install extras. Run the npm hint in a clone.",
      installHint: hint,
    };
  }
  const script = resolveScript(stem);
  if (!script) {
    return { ok: false, extraId: id, mode: "missing-script", error: `Install script missing for ${id}`, installHint: hint };
  }

  const r =
    script.kind === "ps1"
      ? spawnSync(
          "powershell",
          ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script.file],
          { cwd: ROOT, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
        )
      : spawnSync("bash", [script.file], { cwd: ROOT, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });

  const out = `${r.stdout || ""}${r.stderr || ""}`;
  const tail = out
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(-12)
    .join("\n");

  if (r.status === 0) {
    const restart = softRestartSidecar();
    return {
      ok: true,
      extraId: id,
      mode: "installed",
      restarted: restart.ok,
      message: restart.ok
        ? `Installed — sidecar restarted. ${tail || "OK"}`
        : `Installed — could not auto-restart sidecar (${restart.detail}). Run npm run sidecar. ${tail || "OK"}`,
      installHint: hint,
    };
  }
  return {
    ok: false,
    extraId: id,
    mode: "install-failed",
    error: tail || `Install failed (exit ${r.status})`,
    installHint: hint,
  };
}

module.exports = { installSidecarExtra, SCRIPT_STEM, softRestartSidecar };
