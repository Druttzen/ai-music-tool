import { test, expect, request } from "@playwright/test";
import {
  dismissSplash,
  enableGuidedShowAll,
  saveLoadPanel,
  selectSunoEngine,
  vocalEmbedStudioPanel,
} from "./helpers.js";

const BUNDLE_FIXTURE = "tests/fixtures/e2e-import-project-bundle-vocal-align.json";

test.describe("OpenVPI inference live (real /models)", () => {
  test.beforeAll(async () => {
    const ctx = await request.newContext();
    let modelsOk = false;
    try {
      const res = await ctx.get("http://127.0.0.1:8723/vocal-embed/models");
      if (res.ok()) {
        const body = await res.json();
        modelsOk =
          body?.diffsinger_openvpi?.configured === true &&
          typeof body?.diffsinger_openvpi?.ready === "boolean";
      }
    } catch {
      modelsOk = false;
    }
    await ctx.dispose();
    test.skip(!modelsOk, "Sidecar vocal models unavailable — install vocal extra");
  });

  test("reads real OpenVPI status from sidecar without route mocks", async ({ page }) => {
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

    await expect(vocalEmbed.getByText(/OpenVPI:/i)).toBeVisible({ timeout: 20_000 });

    const openvpiReady = await page.evaluate(async () => {
      const res = await fetch("http://127.0.0.1:8723/vocal-embed/models");
      const body = await res.json();
      return !!body?.diffsinger_openvpi?.ready;
    });

    if (openvpiReady) {
      await expect(vocalEmbed.getByTestId("openvpi-inference-ready")).toBeVisible({ timeout: 10_000 });
      await expect(vocalEmbed.getByTestId("synthesize-openvpi")).toBeEnabled();
    } else {
      await expect(vocalEmbed.getByTestId("synthesize-openvpi")).toBeDisabled();
      await expect(vocalEmbed.getByText(/OpenVPI:.*acoustic/i)).toBeVisible();
    }
  });
});
