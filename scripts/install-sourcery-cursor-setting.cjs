#!/usr/bin/env node
/**
 * Install Sourcery auto-fix Cursor rule + hook into .cursor/ (gitignored locally).
 * Source of truth: cursor-settings/sourcery-auto-fix/
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const src = path.join(root, "cursor-settings", "sourcery-auto-fix");
const cursorDir = path.join(root, ".cursor");
const rulesDir = path.join(cursorDir, "rules");
const hooksDir = path.join(cursorDir, "hooks");

function copyFile(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

function mergeHooksJson() {
  const dest = path.join(cursorDir, "hooks.json");
  const fragmentPath = path.join(src, "hooks.json");
  const fragment = JSON.parse(fs.readFileSync(fragmentPath, "utf8"));

  let existing = { version: 1, hooks: {} };
  if (fs.existsSync(dest)) {
    try {
      existing = JSON.parse(fs.readFileSync(dest, "utf8"));
    } catch {
      console.warn("install-sourcery-cursor-setting: could not parse existing hooks.json — replacing hooks section for sourcery only");
    }
  }

  existing.version = existing.version || 1;
  existing.hooks = existing.hooks || {};

  for (const [event, entries] of Object.entries(fragment.hooks || {})) {
    const current = Array.isArray(existing.hooks[event]) ? existing.hooks[event] : [];
    const without = current.filter(
      (h) => !String(h.command || "").includes("sourcery-auto-fix"),
    );
    existing.hooks[event] = [...without, ...(entries || [])];
  }

  fs.writeFileSync(dest, `${JSON.stringify(existing, null, 2)}\n`);
}

if (!fs.existsSync(src)) {
  console.error("install-sourcery-cursor-setting: missing", src);
  process.exit(1);
}

copyFile(
  path.join(src, "rules", "sourcery-auto-fix.mdc"),
  path.join(rulesDir, "sourcery-auto-fix.mdc"),
);
copyFile(
  path.join(src, "hooks", "sourcery-auto-fix.mjs"),
  path.join(hooksDir, "sourcery-auto-fix.mjs"),
);
mergeHooksJson();

console.log("Installed Sourcery auto-fix Cursor setting:");
console.log("  .cursor/rules/sourcery-auto-fix.mdc");
console.log("  .cursor/hooks/sourcery-auto-fix.mjs");
console.log("  .cursor/hooks.json (merged beforeSubmitPrompt hook)");
console.log("");
console.log("Reload Cursor or save hooks.json if hooks do not appear immediately.");
