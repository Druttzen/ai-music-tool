import { test, expect } from "@playwright/test";
import {
  dismissSplash,
  enableGuidedStepCoach,
  saveLoadPanel,
  selectSunoEngine,
} from "./helpers.js";

const BUNDLE_FIXTURE = "tests/fixtures/e2e-import-project-bundle-vocal-align.json";

test.describe("Maestro step coach MusicGen", () => {
  test("coach suggests Maestro for MusicGen sketch and scrolls to chat", async ({ page }) => {
    await dismissSplash(page);
    await selectSunoEngine(page);
    await enableGuidedStepCoach(page);
    await page.reload();
    await page.waitForLoadState("networkidle");

    const panel = saveLoadPanel(page);
    await panel.locator('input[type="file"][accept="application/json"]').setInputFiles(BUNDLE_FIXTURE);

    await page.evaluate(() => {
      const report = {
        fileName: "musicgen-coach.wav",
        duration: 120,
        estimatedBpm: "126 BPM",
        estimatedKey: "Am",
        energy: 58,
        sourceEngine: "musicgen",
        musicGenPrompt: "melodic techno rolling bass",
        trackSummary: "MusicGen preview (musicgen, 10s)",
        peaks: Array.from({ length: 32 }, (_, i) => Math.sin(i / 6)),
      };
      window.dispatchEvent(new CustomEvent("aimc-e2e-set-audio-analysis", { detail: report }));
    });

    const coach = page.getByTestId("guided-step-coach");
    await expect(coach).toBeVisible({ timeout: 12_000 });
    await expect(coach.getByText("Ask Maestro about the MusicGen sketch")).toBeVisible();

    await coach
      .locator("div")
      .filter({ hasText: /^Ask Maestro about the MusicGen sketch/ })
      .getByRole("button", { name: "Apply" })
      .click();

    const maestro = page.getByTestId("maestro-chat-panel");
    await expect(maestro).toBeVisible();
    await expect(maestro.locator("textarea").first()).toHaveValue("Regenerate with melody");
    await expect(page.getByTestId("action-toast")).toContainText(/Maestro prompt ready/i);
  });
});
