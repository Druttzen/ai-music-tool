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
    expect(config.plugins.updater.windows.installMode).toBe("passive");
  });

  it("requires signing and verifies updater assets before publishing", () => {
    const workflow = fs.readFileSync(
      path.join(ROOT, ".github/workflows/tauri-studio-release.yml"),
      "utf8",
    );
    expect(workflow).toContain("TAURI_SIGNING_PRIVATE_KEY");
    expect(workflow).toContain("TAURI_SIGNING_PRIVATE_KEY_PASSWORD");
    expect(workflow).toContain("uploadUpdaterJson: true");
    expect(workflow).toContain("grep -qx 'latest.json'");
    expect(workflow).toContain("grep -q '\\.sig$'");
    expect(workflow).toContain("--draft=false --latest");
    expect(workflow).not.toContain("PRIVATE: C:");
  });
});
