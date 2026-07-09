import { test, expect } from "@playwright/test";
import {
  dismissSplash,
  enableGuidedShowAll,
  selectSunoEngine,
  saveLoadPanel,
} from "./helpers.js";

const BUNDLE_FIXTURE = "tests/fixtures/e2e-import-project-bundle-vocal-align.json";

test.describe("Maestro offline vocal embed", () => {
  test("Maestro shows vocal embed brief for openvpi ds query", async ({ page }) => {
    await dismissSplash(page);
    await selectSunoEngine(page);
    await enableGuidedShowAll(page);

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

    await page.reload();
    await page.waitForLoadState("networkidle");

    const maestro = page.getByTestId("maestro-chat-panel");
    await maestro.scrollIntoViewIfNeeded();

    const input = maestro.locator("textarea").first();
    await input.fill("show openvpi ds");
    await maestro.getByRole("button", { name: /^Send$/i }).click();

    await expect(maestro.getByText(/Vocal Embed plan is ready/i)).toBeVisible({ timeout: 15_000 });
    await expect(maestro.getByText(/OpenVPI \.ds/i)).toBeVisible();
    await expect(maestro.getByText(/Vocal Embed brief/i)).toBeVisible();
  });
});
