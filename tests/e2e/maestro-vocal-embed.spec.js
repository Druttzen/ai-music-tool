import { test, expect } from "@playwright/test";
import {
  dismissSplash,
  enableGuidedShowAll,
  selectSunoEngine,
  saveLoadPanel,
  analyzerPanel,
  clearProjectStorage,
  expectToast,
} from "./helpers.js";
import { maestroChatInput } from "./maestro-chat-input.js";

const BUNDLE_FIXTURE = "tests/fixtures/e2e-import-project-bundle-vocal-align.json";

test.describe("Maestro offline vocal embed", () => {
  test("Maestro shows vocal embed brief for openvpi ds query", async ({ page }) => {
    await clearProjectStorage(page);
    await dismissSplash(page);
    await selectSunoEngine(page);
    await enableGuidedShowAll(page);

    const panel = saveLoadPanel(page);
    await panel.locator('input[type="file"][accept="application/json"]').setInputFiles(BUNDLE_FIXTURE);
    await expectToast(page, /Imported project bundle/i);

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

    await expect(analyzerPanel(page).getByText("e2e-analyzer-tone.wav", { exact: true })).toBeVisible({
      timeout: 10_000,
    });

    const maestro = page.getByTestId("maestro-chat-panel");
    await maestro.scrollIntoViewIfNeeded();

    const input = maestroChatInput(maestro);
    await input.fill("show openvpi ds");
    await maestro.getByRole("button", { name: /^Send$/i }).click();

    await expect(maestro.getByText(/Vocal Embed plan is/i)).toBeVisible({ timeout: 15_000 });
    await expect(maestro.getByText(/OpenVPI \.ds|stored alignment/i)).toBeVisible();
    await expect(maestro.getByText(/Vocal Embed brief/i)).toBeVisible();
  });
});
