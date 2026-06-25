#!/usr/bin/env node
/**
 * Sync product version from package.json to Tauri, dsp-core, and Python sidecar manifests.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const version = require(path.join(root, "package.json")).version;

function replaceTomlVersion(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const current = raw.match(/^version = "([^"]+)"/m);
  if (current?.[1] === version) return;
  const next = raw.replace(/^version = "[^"]+"/m, `version = "${version}"`);
  if (next === raw) throw new Error(`Could not update version in ${filePath}`);
  fs.writeFileSync(filePath, next);
}

function replaceJsonVersion(filePath) {
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  data.version = version;
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function replacePyprojectVersion(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const current = raw.match(/^version = "([^"]+)"/m);
  if (current?.[1] === version) return;
  const next = raw.replace(/^version = "[^"]+"/m, `version = "${version}"`);
  if (next === raw) throw new Error(`Could not update version in ${filePath}`);
  fs.writeFileSync(filePath, next);
}

function replacePyInitVersion(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const current = raw.match(/^__version__ = "([^"]+)"/m);
  if (current?.[1] === version) return;
  const next = raw.replace(/^__version__ = "[^"]+"/m, `__version__ = "${version}"`);
  if (next === raw) throw new Error(`Could not update version in ${filePath}`);
  fs.writeFileSync(filePath, next);
}

replaceJsonVersion(path.join(root, "src-tauri", "tauri.conf.json"));
replaceTomlVersion(path.join(root, "src-tauri", "Cargo.toml"));
replaceTomlVersion(path.join(root, "dsp-core", "Cargo.toml"));
replacePyprojectVersion(path.join(root, "ai-sidecar", "pyproject.toml"));
replacePyInitVersion(path.join(root, "ai-sidecar", "ai_sidecar", "__init__.py"));

console.log(`Synced product version ${version} across manifests.`);
