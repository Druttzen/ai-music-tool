import { test, expect } from "@playwright/test";
import fs from "node:fs";
import {
  dismissSplash,
  enableGuidedShowAll,
  saveLoadPanel,
  selectSunoEngine,
  vocalEmbedStudioPanel,
} from "./helpers.js";

const BUNDLE_FIXTURE = "tests/fixtures/e2e-import-project-bundle-vocal-align.json";

test.describe("OpenVPI ds export e2e", () => {
  test("export OpenVPI ds JSON from Vocal Embed Studio after bundle import", async ({ page }) => {
    await dismissSplash(page);
    await selectSunoEngine(page);
    await enableGuidedShowAll(page);

    const panel = saveLoadPanel(page);
    await panel.locator('input[type="file"][accept="application/json"]').setInputFiles(BUNDLE_FIXTURE);

    await page.evaluate(() => {
      const report = {
        fileName: "e2e-analyzer-tone.wav",
        duration: 120,
        estimatedBpm: "120 BPM",
        estimatedKey: "Am",
        energy: 55,
        peaks: Array.from({ length: 32 }, (_, i) => Math.sin(i / 6)),
      };
      window.dispatchEvent(new CustomEvent("aimc-e2e-set-audio-analysis", { detail: report }));
    });

    const vocalEmbed = vocalEmbedStudioPanel(page);
    await vocalEmbed.scrollIntoViewIfNeeded();

    const downloadPromise = page.waitForEvent("download");
    await vocalEmbed.getByTestId("export-openvpi-ds-plan").click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/openvpi-ds-/);

    const downloadPath = await download.path();
    const raw = JSON.parse(fs.readFileSync(downloadPath, "utf8"));
    expect(raw.format).toBe("openvpi-ds-segments");
    expect(raw.segment_count).toBeGreaterThan(0);
    expect(raw.segments[0].note_seq).toBeTruthy();
  });
});
