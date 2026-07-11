#!/usr/bin/env node
/**
 * Install fail-safe bot Cursor rule into .cursor/ (gitignored locally).
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const src = path.join(root, "cursor-settings", "fail-safe-auto-fix", "rules", "fail-safe-auto-fix.mdc");
const dest = path.join(root, ".cursor", "rules", "fail-safe-auto-fix.mdc");

if (!fs.existsSync(src)) {
  console.error("install-fail-safe-cursor-setting: missing", src);
  process.exit(1);
}

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(src, dest);

console.log("Installed fail-safe bot Cursor rule:");
console.log("  .cursor/rules/fail-safe-auto-fix.mdc");
