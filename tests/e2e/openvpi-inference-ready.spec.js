import { test, expect } from "@playwright/test";
import {
  dismissSplash,
  enableGuidedShowAll,
  saveLoadPanel,
  selectSunoEngine,
  vocalEmbedStudioPanel,
} from "./helpers.js";

const BUNDLE_FIXTURE = "tests/fixtures/e2e-import-project-bundle-vocal-align.json";

test.describe("OpenVPI inference UX", () => {
  test("shows OpenVPI inference banner and synthesize button when models report ready", async ({ page }) => {
    await page.route("**/vocal-embed/models", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          models_ready: true,
          rvc_ready: false,
          diffsinger_configured: true,
          diffsinger_ready: true,
          diffsinger_openvpi: {
            configured: true,
            ready: true,
            root: "/openvpi",
            variance_exp: "var-exp",
            acoustic_exp: "acoustic-exp",
          },
          align: { mfa_configured: false },
        }),
      });
    });
    await page.route("**/health", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          vocal_synthesis_available: true,
          vocal_ml_available: true,
        }),
      });
    });

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

    const vocalEmbed = vocalEmbedStudioPanel(page);
    await vocalEmbed.scrollIntoViewIfNeeded();

    await expect(vocalEmbed.getByTestId("openvpi-inference-ready")).toBeVisible({ timeout: 15_000 });
    await expect(vocalEmbed.getByTestId("synthesize-openvpi")).toBeEnabled();
    await expect(vocalEmbed.getByText(/OpenVPI DiffSinger inference is ready/i)).toBeVisible();
  });
});
