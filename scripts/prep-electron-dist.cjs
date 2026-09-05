#!/usr/bin/env node
/** Electron packaging retired after studio-v0.50.21 — see docs/desktop.md */
console.error(
  "prepare:electron-dist: Electron train retired after studio-v0.50.21.\n" +
    "  Ship Studio with: npm run ship:tag / npm run tauri:build\n" +
    "  See docs/desktop.md",
);
process.exit(1);
