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
  "vocal-ml": "install-sidecar-vocal-ml",
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
    return {
      ok: true,
      extraId: id,
      mode: "installed",
      message: `Installed — restart sidecar. ${tail || "OK"}`,
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

module.exports = { installSidecarExtra, SCRIPT_STEM };
