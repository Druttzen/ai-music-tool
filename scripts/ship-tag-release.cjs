#!/usr/bin/env node
/**
 * Tag-only release: check:full then push studio-v* git tag.
 * Commit version bump first.
 *
 * Usage:
 *   node scripts/ship-tag-release.cjs [vX.Y.Z]
 *
 * Electron `v*` tagging was retired after studio-v0.50.21 (Studio canvas verified).
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const isWin = process.platform === "win32";
const argv = process.argv.slice(2);
const tagArg = argv.find((a) => !a.startsWith("--"));

if (argv.includes("--electron")) {
  console.error(
    "ship-tag-release: Electron train retired after studio-v0.50.21 — Studio only.\n" +
      "  Use `npm run ship:tag` (studio-v*). See docs/desktop.md.",
  );
  process.exit(1);
}

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
run("git", ["push", "origin", "HEAD"]);
run("git", ["push", "origin", studioTag]);

console.log("ship-tag-release: OK — tauri-studio-release.yml (Studio only)");
