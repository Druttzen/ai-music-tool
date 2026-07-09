#!/usr/bin/env node
/**
 * Sync product version from package.json to Tauri, dsp-core, Python sidecar, and app fallbacks.
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.join(__dirname, "..");
const version = require(path.join(root, "package.json")).version;

function replaceTomlVersion(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const current = raw.match(/^version = "([^"]+)"/m);
  if (current?.[1] === version) return false;
  const next = raw.replace(/^version = "[^"]+"/m, `version = "${version}"`);
  if (next === raw) throw new Error(`Could not update version in ${filePath}`);
  fs.writeFileSync(filePath, next);
  return true;
}

/** Keep Cargo.lock root package version in sync after Cargo.toml bumps (CI uses --locked). */
function syncCargoLock(crateDir, packageNames) {
  const dir = path.join(root, crateDir);
  const lockPath = path.join(dir, "Cargo.lock");
  if (!fs.existsSync(lockPath)) return;
  const tomlVersion = fs.readFileSync(path.join(dir, "Cargo.toml"), "utf8").match(/^version = "([^"]+)"/m)?.[1];
  const lockRaw = fs.readFileSync(lockPath, "utf8");
  const names = Array.isArray(packageNames) ? packageNames : [packageNames];
  const stale = names.some((name) => {
    const m = lockRaw.match(new RegExp(`\\nname = "${name}"\\nversion = "([^"]+)"`));
    return m && m[1] !== tomlVersion;
  });
  if (!stale) return;
  try {
    execFileSync("cargo", ["update", ...names.flatMap((n) => ["-p", n])], {
      cwd: dir,
      stdio: "pipe",
    });
  } catch (e) {
    console.warn(
      `Warning: could not refresh ${crateDir}/Cargo.lock — run cargo update there before release (CI uses --locked).`,
    );
    console.warn(e?.message || e);
  }
}

function replaceJsonVersion(filePath) {
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  data.version = version;
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function replacePyprojectVersion(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const current = raw.match(/^version = "([^"]+)"/m);
  if (current?.[1] === version) return;
  const next = raw.replace(/^version = "[^"]+"/m, `version = "${version}"`);
  if (next === raw) throw new Error(`Could not update version in ${filePath}`);
  fs.writeFileSync(filePath, next);
}

function replacePyInitVersion(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const current = raw.match(/^__version__ = "([^"]+)"/m);
  if (current?.[1] === version) return;
  const next = raw.replace(/^__version__ = "[^"]+"/m, `__version__ = "${version}"`);
  if (next === raw) throw new Error(`Could not update version in ${filePath}`);
  fs.writeFileSync(filePath, next);
}

function replacePackageLockVersion(filePath) {
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (data.version === version && data.packages?.[""]?.version === version) return;
  data.version = version;
  if (data.packages?.[""]) data.packages[""].version = version;
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function replaceJsStringLiteral(filePath, pattern, template) {
  const raw = fs.readFileSync(filePath, "utf8");
  const replacement = template(version);
  if (raw.includes(replacement)) return;
  const next = raw.replace(pattern, replacement);
  if (next === raw) throw new Error(`Could not update version in ${filePath}`);
  fs.writeFileSync(filePath, next);
}

replaceJsonVersion(path.join(root, "src-tauri", "tauri.conf.json"));
replaceTomlVersion(path.join(root, "src-tauri", "Cargo.toml"));
replaceTomlVersion(path.join(root, "dsp-core", "Cargo.toml"));
syncCargoLock("dsp-core", "dsp-core");
syncCargoLock("src-tauri", ["ai-music-studio", "dsp-core"]);
replacePyprojectVersion(path.join(root, "ai-sidecar", "pyproject.toml"));
replacePyInitVersion(path.join(root, "ai-sidecar", "ai_sidecar", "__init__.py"));
replacePackageLockVersion(path.join(root, "package-lock.json"));
replaceJsStringLiteral(
  path.join(root, "app", "lib", "music-config.js"),
  /    : "0\.\d+\.\d+";/,
  (v) => `    : "${v}";`,
);
replaceJsStringLiteral(
  path.join(root, "app", "lib", "musicbrainz-style-dna.js"),
  /AI-Music-Creator\/0\.\d+\.\d+/,
  (v) => `AI-Music-Creator/${v}`,
);

console.log(`Synced product version ${version} across manifests.`);
