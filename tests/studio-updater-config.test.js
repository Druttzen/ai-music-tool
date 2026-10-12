import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "..");

describe("Studio updater release contract", () => {
  it("configures signed GitHub updater artifacts", () => {
    const config = JSON.parse(fs.readFileSync(path.join(ROOT, "src-tauri/tauri.conf.json"), "utf8"));
    expect(config.bundle.createUpdaterArtifacts).toBe(true);
    expect(config.plugins.updater.pubkey).toMatch(/^dW50cnVzdGVk/);
    expect(config.plugins.updater.endpoints).toEqual([
      "https://github.com/Druttzen/ai-music-tool/releases/latest/download/latest.json",
    ]);
    expect(config.plugins.updater.windows.installMode).toBe("quiet");
    expect(config.bundle.macOS.minimumSystemVersion).toBe("14.0");
  });

  it("requires signing and verifies updater assets before publishing", () => {
    const workflow = fs.readFileSync(
      path.join(ROOT, ".github/workflows/tauri-studio-release.yml"),
      "utf8",
    );
    expect(workflow).toContain("TAURI_SIGNING_PRIVATE_KEY");
    expect(workflow).toContain("TAURI_SIGNING_PRIVATE_KEY_PASSWORD");
    expect(workflow).toContain("uploadUpdaterJson: true");
    expect(workflow).toContain("macos-15-intel");
    expect(workflow).toContain("tauriScript: npx tauri");
    expect(workflow).not.toContain("cargo install tauri-cli");
    expect(workflow).toContain("verify-studio-release.cjs release-assets");
    expect(workflow).toContain("test-windows-studio-upgrade.ps1");
    expect(workflow).toContain("--lib --locked");
    expect(workflow).toContain("--draft=false --latest");
    expect(workflow).not.toContain("PRIVATE: C:");
  });
});
