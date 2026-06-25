import { test, expect, request } from "@playwright/test";
import { analyzerPanel, dismissSplash } from "./helpers.js";

const ANALYZER_FIXTURE = "tests/fixtures/e2e-analyzer-tone.wav";

test.describe("Sidecar UI smoke", () => {
  test.beforeAll(async () => {
    const ctx = await request.newContext();
    const res = await ctx.get("http://127.0.0.1:8723/health");
    expect(res.ok(), "AI sidecar must be running on http://127.0.0.1:8723 (npm run sidecar)").toBeTruthy();
    await ctx.dispose();
  });

  test("shows librosa ready badge and enriches track report via sidecar", async ({ page }) => {
    await dismissSplash(page);

    const panel = analyzerPanel(page);
    await panel.scrollIntoViewIfNeeded();

    await expect(panel.getByText("librosa ready")).toBeVisible({ timeout: 20_000 });

    await panel.locator('input[type="file"][accept*="audio/wav"]').setInputFiles(ANALYZER_FIXTURE);

    await expect(panel.getByText("e2e-analyzer-tone.wav", { exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await expect(panel.getByText(/local librosa analysis \(Python sidecar\)/i)).toBeVisible({
      timeout: 30_000,
    });
  });
});
