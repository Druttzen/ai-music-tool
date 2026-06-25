import { describe, it, expect } from "vitest";
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = path.join(root, "scripts", "sync-product-version.cjs");
const version = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version;

describe("sync-product-version", () => {
  it("runs idempotently when manifests already match package.json", () => {
    expect(() => execFileSync(process.execPath, [script], { cwd: root, encoding: "utf8" })).not.toThrow();
    expect(() => execFileSync(process.execPath, [script], { cwd: root, encoding: "utf8" })).not.toThrow();
  });

  it("keeps Tauri and sidecar versions aligned with package.json", () => {
    execFileSync(process.execPath, [script], { cwd: root });

    const tauriConf = JSON.parse(fs.readFileSync(path.join(root, "src-tauri", "tauri.conf.json"), "utf8"));
    expect(tauriConf.version).toBe(version);

    const dspToml = fs.readFileSync(path.join(root, "dsp-core", "Cargo.toml"), "utf8");
    expect(dspToml).toMatch(new RegExp(`^version = "${version.replace(/\./g, "\\.")}"`, "m"));

    const pyproject = fs.readFileSync(path.join(root, "ai-sidecar", "pyproject.toml"), "utf8");
    expect(pyproject).toMatch(new RegExp(`^version = "${version.replace(/\./g, "\\.")}"`, "m"));
  });
});
