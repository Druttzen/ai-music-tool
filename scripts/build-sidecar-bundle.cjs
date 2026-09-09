/**
 * Cross-platform entry for PyInstaller sidecar bundle (Windows .ps1 / Unix .sh).
 * Rebuilds when the host-triple binary is missing or its version stamp
 * does not match package.json (stale binaries reported /health 0.1.0).
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const binDir = path.join(root, "src-tauri", "binaries");
const pkgVersion = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version;

function hostTriple() {
  const r = spawnSync("rustc", ["-vV"], { encoding: "utf8" });
  if (r.status !== 0) return null;
  const m = r.stdout.match(/^host: (.+)$/m);
  return m ? m[1].trim() : null;
}

function expectedBinaryName(triple) {
  const base = `ai-sidecar-${triple}`;
  return triple.includes("windows") ? `${base}.exe` : base;
}

function stampPath(binaryPath) {
  return `${binaryPath}.version`;
}

function binaryIsCurrent(binaryPath) {
  if (!fs.existsSync(binaryPath)) return false;
  const stamp = stampPath(binaryPath);
  if (!fs.existsSync(stamp)) return false;
  return fs.readFileSync(stamp, "utf8").trim() === String(pkgVersion);
}

const triple = hostTriple();
if (triple && process.env.FORCE_SIDECAR_REBUILD !== "1") {
  const dest = path.join(binDir, expectedBinaryName(triple));
  if (binaryIsCurrent(dest)) {
    console.log(`Sidecar binary current (${path.basename(dest)} ${pkgVersion}) — skip PyInstaller rebuild`);
    process.exit(0);
  }
  if (fs.existsSync(dest)) {
    console.log(
      `Sidecar binary stale or unstamped (${path.basename(dest)}) — rebuilding for ${pkgVersion}`,
    );
  }
}

const isWin = process.platform === "win32";
const script = path.join(__dirname, isWin ? "build-sidecar-bundle.ps1" : "build-sidecar-bundle.sh");

const result = isWin
  ? spawnSync(
      "powershell",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script],
      { stdio: "inherit", cwd: root },
    )
  : spawnSync("bash", [script], { stdio: "inherit", cwd: root });

if ((result.status ?? 1) === 0 && triple) {
  const dest = path.join(binDir, expectedBinaryName(triple));
  if (fs.existsSync(dest)) {
    fs.writeFileSync(stampPath(dest), `${pkgVersion}\n`, "utf8");
    console.log(`Sidecar binary stamped ${pkgVersion}`);
  }
}

process.exit(result.status ?? 1);
