#!/usr/bin/env node
/**
 * Tag-only release: check:full then push git tag (CI release.yml builds installer).
 * Commit version bump first. Usage: node scripts/ship-tag-release.cjs [vX.Y.Z]
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const isWin = process.platform === "win32";

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
const tag = process.argv[2] || `v${pkg.version}`;

const status = spawnSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" });
if (status.stdout?.trim()) {
  console.error("ship-tag-release: commit or stash working tree changes before tagging.");
  process.exit(1);
}

console.log(`ship-tag-release: check:full + e2e subset for ${tag}`);
run(process.execPath, [path.join(__dirname, "run-check-full.cjs"), "--e2e-subset"]);

console.log(`ship-tag-release: pushing tags ${tag} + studio-${tag}`);
const studioTag = `studio-${tag}`;
run("git", ["tag", tag]);
run("git", ["tag", studioTag]);
run("git", ["push", "origin", "HEAD"]);
run("git", ["push", "origin", tag, studioTag]);

console.log(
  "ship-tag-release: OK — release.yml (Electron) + tauri-studio-release.yml (Tauri)",
);
