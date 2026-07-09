import { test, expect } from "@playwright/test";
import {
  dismissSplash,
  saveLoadPanel,
  selectSunoEngine,
  vocalEmbedStudioPanel,
} from "./helpers.js";

const BUNDLE_FIXTURE = "tests/fixtures/e2e-import-project-bundle-vocal-align.json";

test.describe("Step coach OpenVPI ds", () => {
  test("coach suggests OpenVPI ds export and scrolls to Vocal Embed", async ({ page }) => {
    await dismissSplash(page);
    await selectSunoEngine(page);

    const panel = saveLoadPanel(page);
    await panel.locator('input[type="file"][accept="application/json"]').setInputFiles(BUNDLE_FIXTURE);

    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent("aimc-e2e-set-audio-analysis", {
          detail: {
            fileName: "e2e-analyzer-tone.wav",
            duration: 120,
            estimatedBpm: "120 BPM",
            estimatedKey: "Am",
            peaks: Array.from({ length: 32 }, (_, i) => Math.sin(i / 6)),
          },
        }),
      );
    });

    const coach = page.getByTestId("guided-step-coach");
    await expect(coach).toBeVisible({ timeout: 5000 });
    await expect(coach.getByText("Export OpenVPI .ds for DiffSinger")).toBeVisible();

    const row = coach.locator("div").filter({ hasText: "Export OpenVPI .ds for DiffSinger" }).first();
    await row.getByRole("button", { name: "Apply" }).click();

    await expect(vocalEmbedStudioPanel(page)).toBeVisible();
    await expect(page.getByTestId("action-toast")).toContainText(/Vocal Embed/i);
  });
});
