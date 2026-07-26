#!/usr/bin/env node
/**
 * Pre-publish ladder until studio-v* tag.
 *
 * Usage:
 *   npm run ship:ready              # sync + check:ci:e2e-subset
 *   npm run ship:ready -- --tauri   # also local tauri:build
 *   npm run ship:ready -- --smoke   # also sidecar analyze smoke
 *   npm run ship:ready -- --full    # e2e-subset + smoke + tauri
 *   npm run ship:ready -- --print   # print checklist only (no gates)
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const isWin = process.platform === "win32";
const argv = process.argv.slice(2);
const printOnly = argv.includes("--print");
const wantTauri = argv.includes("--tauri") || argv.includes("--full");
const wantSmoke = argv.includes("--smoke") || argv.includes("--full");
const wantE2e = !argv.includes("--no-e2e");

function run(cmd, args) {
  const r = spawnSync(cmd, args, {
    cwd: root,
    stdio: "inherit",
    shell: isWin && (cmd === "npm" || cmd.endsWith(".cmd")),
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

function printChecklist(pkgVersion) {
  const studioTag = `studio-v${pkgVersion}`;
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  AI Music Creator — publish path (Studio)
  Version in package.json: ${pkgVersion}  →  tag ${studioTag}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1) Clean tree on master (or release branch)
   git status
   git checkout master && git pull

2) Automated gates (this script)
   npm run ship:ready              # recommended minimum
   npm run ship:ready -- --full    # + smoke + local tauri:build

3) Manual Studio smoke (pick one)
   npm run tauri:dev               # interactive
   # or install local build from src-tauri/target/release/bundle/

   Click through: analyze track · waveform · export/LUFS · vocal embed (if used)

4) Optional ML (only if you care about those features)
   npm run test:smoke
   npm run sidecar:stems && npm run test:smoke:stems
   npm run sidecar:generate && npm run test:smoke:generate
   npm run test:smoke:vocal

5) Bump version if needed
   edit package.json version → npm run sync:version → commit

6) Publish (CI builds installers + GitHub Release)
   npm run ship:tag                # pushes ${studioTag} only
   npm run ship:tag -- --electron  # also legacy v* Electron

7) After CI finishes
   Open https://github.com/Druttzen/ai-music-tool/releases
   Download Windows installer · install on a clean profile · smoke again

Notes
  • Studio auto-update requires the TAURI_SIGNING_PRIVATE_KEY and TAURI_SIGNING_PRIVATE_KEY_PASSWORD repository secrets.
  • Electron train is maintenance-only; default ship is Studio.
  • Docs: docs/publish.md · docs/desktop.md
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
printChecklist(pkg.version);

if (printOnly) {
  process.exit(0);
}

const status = spawnSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" });
if (status.stdout?.trim()) {
  console.warn("ship-ready: working tree has changes — gates still run; commit before ship:tag.\n");
}

console.log("ship-ready: sync:version");
run("npm", ["run", "sync:version"]);

if (wantE2e) {
  console.log("ship-ready: check:ci:e2e-subset");
  run("npm", ["run", "check:ci:e2e-subset"]);
} else {
  console.log("ship-ready: check:ci");
  run("npm", ["run", "check:ci"]);
}

if (wantSmoke) {
  console.log("ship-ready: test:smoke (sidecar analyze)");
  run("npm", ["run", "test:smoke"]);
}

if (wantTauri) {
  console.log("ship-ready: tauri:build (local installer — slow)");
  run("npm", ["run", "tauri:build"]);
  console.log("ship-ready: installers under src-tauri/target/release/bundle/");
}

console.log("\nship-ready: OK — run manual Studio smoke, then: npm run ship:tag");
console.log("  Re-print checklist: npm run ship:ready -- --print");
