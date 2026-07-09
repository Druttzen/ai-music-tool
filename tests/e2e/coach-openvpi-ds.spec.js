import { test, expect } from "@playwright/test";
import {
  dismissSplash,
  enableGuidedStepCoach,
  expectToast,
  saveLoadPanel,
  selectSunoEngine,
  vocalEmbedStudioPanel,
} from "./helpers.js";

const BUNDLE_FIXTURE = "tests/fixtures/e2e-import-project-bundle-vocal-align.json";

test.describe("Step coach OpenVPI ds", () => {
  test("coach suggests OpenVPI ds export and scrolls to Vocal Embed", async ({ page }) => {
    await dismissSplash(page);
    await selectSunoEngine(page);
    await enableGuidedStepCoach(page);
    await page.reload();
    await page.waitForLoadState("networkidle");

    const panel = saveLoadPanel(page);
    await panel.locator('input[type="file"][accept="application/json"]').setInputFiles(BUNDLE_FIXTURE);
    await expectToast(page, /Imported project bundle/i);

    await expect
      .poll(async () =>
        page.evaluate(() => localStorage.getItem("ai_music_creator_visual_tool_v3")?.includes("warm baritone")),
      { timeout: 10_000 })
      .toBe(true);

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

    await page.waitForTimeout(2200);

    const coach = page.getByTestId("guided-step-coach");
    await expect(coach).toBeVisible({ timeout: 12_000 });
    await expect(coach.getByText("Export OpenVPI .ds for DiffSinger")).toBeVisible({ timeout: 12_000 });

    const row = coach.locator("div").filter({ hasText: "Export OpenVPI .ds for DiffSinger" }).first();
    await row.getByRole("button", { name: "Apply" }).click();

    await expect(vocalEmbedStudioPanel(page)).toBeVisible();
    await expect(page.getByTestId("action-toast")).toContainText(/Vocal Embed/i);
  });
});
