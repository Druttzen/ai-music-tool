/**
 * In-app smoke: Preview monitor strip + FLAC/M4A format controls in Analyzers.
 * Native FLAC/M4A encode is covered by dsp-core smoke_writes_flac_and_m4a_artifacts.
 */
import { expect, test } from "@playwright/test";
import {
  analyzerPanel,
  dismissSplash,
  uploadAnalyzerAudioFixture,
} from "./helpers.js";

const ANALYZER_FIXTURE = "tests/fixtures/e2e-analyzer-tone.wav";

test.describe("preview monitor + flac export smoke", () => {
  test("shows Preview monitor and FLAC/M4A format after audio attach", async ({ page }) => {
    test.setTimeout(120_000);
    await dismissSplash(page);
    const panel = analyzerPanel(page);
    await expect(panel.getByRole("heading", { name: "Drag & Drop Analyzers" })).toBeVisible();

    await uploadAnalyzerAudioFixture(panel, ANALYZER_FIXTURE, "e2e-analyzer-tone.wav");

    await expect(panel.getByText("Preview monitor")).toBeVisible({ timeout: 30_000 });
    await expect(panel.getByText("Live spectrum")).toBeVisible();
    await expect(panel.getByText("Attach A/B reference")).toBeVisible();
    await expect(panel.getByText("Preview EQ — not Atmos / not DTS")).toBeVisible();

    const flacBtn = panel.getByRole("button", { name: "FLAC", exact: true });
    const m4aBtn = panel.getByRole("button", { name: "M4A (AAC)", exact: true });
    await expect(flacBtn).toBeVisible();
    await expect(m4aBtn).toBeVisible();
    await flacBtn.click();
    await expect(flacBtn).toHaveClass(/bg-violet-400/);
    await m4aBtn.click();
    await expect(m4aBtn).toHaveClass(/bg-violet-400/);
    await expect(panel.getByRole("button", { name: /Streaming.*LUFS/i })).toBeVisible();

    await panel.getByRole("button", { name: "WAV 16-bit", exact: true }).click();
    const downloadPromise = page.waitForEvent("download", { timeout: 60_000 }).catch(() => null);
    await panel.getByRole("button", { name: /Measure only/i }).click();
    await expect(page.getByTestId("action-toast").getByText(/Studio export started/i)).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByTestId("action-toast").getByText(/downloaded|Studio export failed|Attach the audio/i),
    ).toBeVisible({ timeout: 60_000 });
    const download = await downloadPromise;
    if (download) {
      expect(download.suggestedFilename()).toMatch(/\.wav$/i);
    }
  });
});
