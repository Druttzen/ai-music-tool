#!/usr/bin/env node
/**
 * Install architecture-convergence Cursor rule into .cursor/ (gitignored locally).
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const src = path.join(
  root,
  "cursor-settings",
  "architecture-convergence",
  "rules",
  "architecture-convergence.mdc",
);
const dest = path.join(root, ".cursor", "rules", "architecture-convergence.mdc");

if (!fs.existsSync(src)) {
  console.error("install-architecture-cursor-setting: missing", src);
  process.exit(1);
}

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(src, dest);

console.log("Installed architecture convergence Cursor rule:");
console.log("  .cursor/rules/architecture-convergence.mdc");
