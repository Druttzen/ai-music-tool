import { test, expect, request } from "@playwright/test";
import {
  dismissSplash,
  enableGuidedShowAll,
  expectToast,
  saveLoadPanel,
  selectSunoEngine,
  vocalEmbedStudioPanel,
} from "./helpers.js";

const BUNDLE_FIXTURE = "tests/fixtures/e2e-import-project-bundle-vocal-align.json";

test.describe("OpenVPI synth live (real inference)", () => {
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    const ctx = await request.newContext();
    let ready = false;
    try {
      const res = await ctx.get("http://127.0.0.1:8723/vocal-embed/models");
      if (res.ok()) {
        const body = await res.json();
        ready = body?.diffsinger_openvpi?.configured === true && body?.diffsinger_openvpi?.ready === true;
      }
    } catch {
      ready = false;
    }
    await ctx.dispose();
    test.skip(!ready, "OpenVPI checkpoints not ready — install vocal-ml extra with configured checkpoints");
  });

  test("synthesizes OpenVPI preview when checkpoints are ready", async ({ page }) => {
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

    const vocalEmbed = vocalEmbedStudioPanel(page);
    await vocalEmbed.scrollIntoViewIfNeeded();

    await expect(vocalEmbed.getByTestId("openvpi-inference-ready")).toBeVisible({ timeout: 20_000 });
    const synth = vocalEmbed.getByTestId("synthesize-openvpi");
    await expect(synth).toBeEnabled();

    await synth.click();
    await expectToast(page, /Vocal embed preview downloaded|OpenVPI/i, 120_000);
  });
});
