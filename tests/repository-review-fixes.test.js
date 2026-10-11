import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { LLM_PROVIDER_PRESETS } from "../app/lib/co-producer-llm";

describe("repository review regression checks", () => {
  it("allows every offered external LLM provider in both desktop policies", () => {
    const config = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"));
    for (const provider of LLM_PROVIDER_PRESETS) {
      const origin = new URL(provider.apiUrl).origin;
      if (origin.includes("localhost") || origin.includes("127.0.0.1")) continue;
      expect(config.app.security.csp).toContain(origin);
      expect(config.app.security.devCsp).toContain(origin);
    }
  });

  it("refuses automatic publishing when the checkout already contains changes", () => {
    // The implementation under test is necessarily modified in this checkout.
    const dirty = spawnSync("git", ["status", "--porcelain"], { encoding: "utf8", shell: false });
    if (!dirty.stdout.trim()) return;
    const result = spawnSync(process.execPath, ["scripts/fail-safe-fix-and-push.cjs", "--app"], {
      encoding: "utf8", shell: false,
    });
    expect(result.status).toBe(1);
    const payload = JSON.parse(result.stdout.trim());
    expect(payload.stage).toBe("worktree");
    expect(payload.message).toContain("No repair or push was performed");
  });
});
