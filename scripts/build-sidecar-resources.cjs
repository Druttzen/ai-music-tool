#!/usr/bin/env node
/**
 * Copy a slim ai-sidecar package tree into src-tauri/resources for Tauri bundle.resources.
 * Includes pyproject.toml + ai_sidecar/ only (no .venv).
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const src = path.join(root, "ai-sidecar");
const dest = path.join(root, "src-tauri", "resources", "ai-sidecar");

const SKIP_DIRS = new Set([
  ".venv",
  "__pycache__",
  ".pytest_cache",
  "dist",
  "build",
  ".ruff_cache",
  "tests",
  ".git",
]);

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const name of fs.readdirSync(from)) {
    if (SKIP_DIRS.has(name)) continue;
    const a = path.join(from, name);
    const b = path.join(to, name);
    const st = fs.statSync(a);
    if (st.isDirectory()) copyDir(a, b);
    else if (st.isFile()) fs.copyFileSync(a, b);
  }
}

function main() {
  if (!fs.existsSync(path.join(src, "pyproject.toml")) || !fs.existsSync(path.join(src, "ai_sidecar", "main.py"))) {
    console.error("build:sidecar-resources — ai-sidecar package incomplete");
    process.exit(1);
  }
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  fs.copyFileSync(path.join(src, "pyproject.toml"), path.join(dest, "pyproject.toml"));
  copyDir(path.join(src, "ai_sidecar"), path.join(dest, "ai_sidecar"));
  // hatchling may need README for metadata; optional
  const readme = path.join(src, "README.md");
  if (fs.existsSync(readme)) fs.copyFileSync(readme, path.join(dest, "README.md"));
  console.log(`build:sidecar-resources — wrote ${path.relative(root, dest)}`);
}

main();
