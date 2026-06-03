/**
 * Prepare for electron-builder on Windows:
 * 1) Stop packaged app so app.asar is not locked.
 * 2) Remove {output}/win-unpacked when possible.
 * 3) If default output stays locked, pick a fresh fallback folder and write build/.electron-dist-output.
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { setTimeout: delay } = require("timers/promises");

const ROOT = path.join(__dirname, "..");
const PRODUCT_EXE = "AI Music Creator.exe";
const MARKER_PATH = path.join(ROOT, "build", ".electron-dist-output");

function readPkg() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
}

function defaultOutputDir() {
  const pkg = readPkg();
  return pkg.build?.directories?.output || pkg.build?.directories?.Output || "electron-dist";
}

function fallbackCandidates(version) {
  const safe = String(version || "0").replace(/\./g, "");
  return ["electron-dist-fresh", `electron-dist-v${safe}`];
}

function writeOutputMarker(outputDir) {
  fs.mkdirSync(path.dirname(MARKER_PATH), { recursive: true });
  fs.writeFileSync(MARKER_PATH, `${outputDir}\n`, "utf8");
}

async function tryRemove(targetPath, maxAttempts = 6) {
  if (!fs.existsSync(targetPath)) return true;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      fs.rmSync(targetPath, { recursive: true, force: true });
      return true;
    } catch (err) {
      console.warn(
        `prep-electron-dist: could not remove ${path.relative(ROOT, targetPath)} (attempt ${attempt}/${maxAttempts}):`,
        err.message,
      );
      await delay(1500);
    }
  }
  return false;
}

/**
 * @param {string} outputDir — folder name under repo root (e.g. electron-dist)
 */
async function prepareOutputDir(outputDir) {
  const root = path.join(ROOT, outputDir);
  const unpacked = path.join(root, "win-unpacked");

  if (!fs.existsSync(unpacked)) return true;

  if (await tryRemove(unpacked)) return true;
  return tryRemove(root, 3);
}

async function main() {
  const pkg = readPkg();
  const preferred = defaultOutputDir();

  writeOutputMarker(preferred);

  if (process.platform !== "win32") {
    console.log(`prep-electron-dist: non-Windows — using ${preferred}`);
    return;
  }

  try {
    execSync(`taskkill /F /IM "${PRODUCT_EXE}"`, {
      stdio: "ignore",
      windowsHide: true,
    });
    console.log(`Stopped ${PRODUCT_EXE} before packaging.`);
  } catch {
    // Not running — OK
  }

  await delay(1200);

  if (await prepareOutputDir(preferred)) {
    writeOutputMarker(preferred);
    const unpacked = path.join(ROOT, preferred, "win-unpacked");
    if (!fs.existsSync(unpacked)) {
      console.log(`prep-electron-dist: ${preferred} is ready for electron-builder.`);
    } else {
      console.log(
        `Removed ${path.relative(ROOT, unpacked)} so electron-builder can repackage.`,
      );
    }
    return;
  }

  console.warn(
    `\nprep-electron-dist: ${preferred} is locked — trying fallback output folders…`,
  );

  for (const candidate of fallbackCandidates(pkg.version)) {
    const candidateRoot = path.join(ROOT, candidate);
    if (!fs.existsSync(candidateRoot)) {
      writeOutputMarker(candidate);
      console.log(`prep-electron-dist: using ${candidate} (new folder).`);
      return;
    }
    if (await prepareOutputDir(candidate)) {
      writeOutputMarker(candidate);
      console.log(`prep-electron-dist: using ${candidate} (cleared locked unpack).`);
      return;
    }
  }

  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..+/, "")
    .slice(0, 14);
  const fallback = `electron-dist-build-${stamp}`;
  writeOutputMarker(fallback);
  console.log(
    `prep-electron-dist: using ${fallback} (default and fallbacks locked — installer will land here).`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
