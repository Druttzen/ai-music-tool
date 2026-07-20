#!/usr/bin/env node
/**
 * Tag-only release: check:full then push git tag(s).
 * Commit version bump first.
 *
 * Usage:
 *   node scripts/ship-tag-release.cjs [vX.Y.Z]             # studio-v* only (default)
 *   node scripts/ship-tag-release.cjs [vX.Y.Z] --electron  # also push Electron v* tag
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const isWin = process.platform === "win32";
const argv = process.argv.slice(2);
const withElectron = argv.includes("--electron");
const tagArg = argv.find((a) => !a.startsWith("--"));

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    stdio: "inherit",
    cwd: root,
    shell: isWin && (cmd === "npm" || cmd.endsWith(".cmd")),
    ...opts,
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const raw = tagArg || `v${pkg.version}`;
const versionTag = raw.startsWith("v") ? raw : `v${raw}`;
const studioTag = `studio-${versionTag}`;

const status = spawnSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" });
if (status.stdout?.trim()) {
  console.error("ship-tag-release: commit or stash working tree changes before tagging.");
  process.exit(1);
}

console.log(`ship-tag-release: check:full + e2e subset for ${studioTag}`);
run(process.execPath, [path.join(__dirname, "run-check-full.cjs"), "--e2e-subset"]);

run("git", ["tag", studioTag]);
const pushTags = [studioTag];
if (withElectron) {
  console.log(`ship-tag-release: also tagging Electron ${versionTag} (--electron)`);
  run("git", ["tag", versionTag]);
  pushTags.push(versionTag);
} else {
  console.log(`ship-tag-release: studio-only (pass --electron to also push ${versionTag})`);
}

run("git", ["push", "origin", "HEAD"]);
run("git", ["push", "origin", ...pushTags]);

console.log(
  withElectron
    ? "ship-tag-release: OK — tauri-studio-release.yml + release.yml (Electron)"
    : "ship-tag-release: OK — tauri-studio-release.yml (Tauri Studio primary)",
);
