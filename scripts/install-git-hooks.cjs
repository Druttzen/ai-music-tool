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

  if (r.error) {
    const code = r.error.code || "";
    if (code === "ENOENT") {
      console.error("install-git-hooks: git is not installed or not available on PATH");
      console.error(`  (${r.error.message})`);
    } else {
      console.error("install-git-hooks: failed to run git");
      console.error(`  (${r.error.message})`);
    }
    process.exit(1);
  }

  if (r.status !== 0 || !String(r.stdout || "").trim()) {
    console.error("install-git-hooks: not a git repository (git rev-parse --git-dir failed)");
    if (r.stderr) process.stderr.write(r.stderr);
    process.exit(r.status ?? 1);
  }

  const gitDir = String(r.stdout).trim();
  return path.isAbsolute(gitDir) ? gitDir : path.resolve(root, gitDir);
}

const hooksDir = path.join(resolveGitDir(), "hooks");
fs.mkdirSync(hooksDir, { recursive: true });

const prePush = `#!/bin/sh
# AI Music Creator — pre-push CI gate (npm run bots:install)
if [ "$SKIP_CI_PREFLIGHT" = "1" ]; then
  echo "pre-push: SKIP_CI_PREFLIGHT=1 — skipping check:ci"
  exit 0
fi
if [ "$FAIL_SAFE_PRE_PUSH" = "1" ]; then
  echo "pre-push: FAIL_SAFE_PRE_PUSH=1 — running npm run fail-safe:run"
  npm run fail-safe:run || exit 1
  exit 0
fi
echo "pre-push: running npm run check:ci (set SKIP_CI_PREFLIGHT=1 to skip)"
npm run check:ci || {
  echo ""
  echo "pre-push: failed — try: npm run fail-safe:run"
  echo "  auto-fix on push: FAIL_SAFE_PRE_PUSH=1 git push"
  echo "  skip once: SKIP_CI_PREFLIGHT=1 git push"
  exit 1
}
`;

const hookPath = path.join(hooksDir, "pre-push");
fs.writeFileSync(hookPath, prePush.replace(/\r\n/g, "\n"), { mode: 0o755 });
console.log("Installed pre-push hook →", hookPath);
console.log("  Runs: npm run check:ci");
console.log("  Auto-fix mode: FAIL_SAFE_PRE_PUSH=1 git push");
console.log("  Skip once: SKIP_CI_PREFLIGHT=1 git push");
