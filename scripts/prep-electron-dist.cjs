/**
 * Prepare for electron-builder on Windows:
 * 1) Stop packaged app so app.asar is not locked.
 * 2) Remove {output}/win-unpacked with retries (see package.json build.directories.output).
 *
 * Output defaults to electron-dist so a stale locked dist/ tree does not block builds.
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { setTimeout: delay } = require("timers/promises");

const PRODUCT_EXE = "AI Music Creator.exe";

function buildOutputRoot() {
  try {
    const pkg = require(path.join(__dirname, "..", "package.json"));
    const out =
      pkg.build?.directories?.output ||
      pkg.build?.directories?.Output ||
      "electron-dist";
    return path.join(__dirname, "..", out);
  } catch {
    return path.join(__dirname, "..", "electron-dist");
  }
}

async function main() {
  if (process.platform !== "win32") return;

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

  const unpacked = path.join(buildOutputRoot(), "win-unpacked");
  if (!fs.existsSync(unpacked)) return;

  const maxAttempts = 6;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      fs.rmSync(unpacked, { recursive: true, force: true });
      console.log(
        `Removed ${path.relative(process.cwd(), unpacked)} so electron-builder can repackage.`,
      );
      return;
    } catch (err) {
      console.warn(
        `prep-electron-dist: could not remove win-unpacked (attempt ${attempt}/${maxAttempts}):`,
        err.message,
      );
      await delay(1500);
    }
  }

  console.error(
    `\nprep-electron-dist: Close AI Music Creator, exit Explorer inside the output folder, then run npm run dist again.`,
  );
  process.exit(1);
}

main();
