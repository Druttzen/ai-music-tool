#!/usr/bin/env node
/**
 * Install repo git hooks (pre-push runs npm run check:ci).
 * Skip once: SKIP_CI_PREFLIGHT=1 git push
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.join(__dirname, "..");

function resolveGitDir() {
  const r = spawnSync("git", ["rev-parse", "--git-dir"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
  });
  if (r.status !== 0 || !String(r.stdout || "").trim()) {
    console.error("install-git-hooks: not a git repository (git rev-parse --git-dir failed)");
    if (r.stderr) process.stderr.write(r.stderr);
    process.exit(1);
  }
  const gitDir = String(r.stdout).trim();
  return path.isAbsolute(gitDir) ? gitDir : path.resolve(root, gitDir);
}

const hooksDir = path.join(resolveGitDir(), "hooks");
fs.mkdirSync(hooksDir, { recursive: true });

const prePush = `#!/bin/sh
# AI Music Creator — pre-push CI gate (npm run hooks:install)
if [ "$SKIP_CI_PREFLIGHT" = "1" ]; then
  echo "pre-push: SKIP_CI_PREFLIGHT=1 — skipping check:ci"
  exit 0
fi
echo "pre-push: running npm run check:ci (set SKIP_CI_PREFLIGHT=1 to skip)"
npm run check:ci || exit 1
`;

const hookPath = path.join(hooksDir, "pre-push");
fs.writeFileSync(hookPath, prePush.replace(/\r\n/g, "\n"), { mode: 0o755 });
console.log("Installed pre-push hook →", hookPath);
console.log("  Runs: npm run check:ci");
console.log("  Skip once: SKIP_CI_PREFLIGHT=1 git push");
