#!/usr/bin/env node
/**
 * Install repo git hooks (pre-push runs npm run check:ci).
 * Skip once: SKIP_CI_PREFLIGHT=1 git push
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const gitDir = path.join(root, ".git");
const hooksDir = path.join(gitDir, "hooks");

if (!fs.existsSync(gitDir)) {
  console.error("install-git-hooks: not a git repository (.git missing)");
  process.exit(1);
}

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
