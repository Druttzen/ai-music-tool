import { test, expect } from "@playwright/test";
import {
  analyzerPanel,
  dismissSplash,
  expectSunoFieldCopies,
  selectSunoEngine,
} from "./helpers.js";

test.describe("MusicGen merge e2e", () => {
  test("merge MusicGen-shaped analyzer report includes MG in Style", async ({ page, context }) => {
    await dismissSplash(page);
    await selectSunoEngine(page);

    const panel = analyzerPanel(page);
    await panel.scrollIntoViewIfNeeded();

    await page.evaluate(() => {
      const report = {
        fileName: "musicgen-e2e.wav",
        estimatedBpm: "126 BPM",
        estimatedKey: "Am",
        energy: 58,
        aggression: 35,
        brightness: 52,
        suggestedGenres: ["Melodic Techno"],
        suggestedSounds: ["Rolling bass"],
        suggestedRhythms: ["4/4"],
        sourceEngine: "musicgen",
        musicGenPrompt: "melodic techno rolling bass hypnotic",
        trackSummary: "MusicGen preview (musicgen, 10s)",
        vocals: "Instrumental (MusicGen)",
        peaks: Array.from({ length: 64 }, (_, i) => Math.sin(i / 8)),
      };
      window.dispatchEvent(
        new CustomEvent("aimc-e2e-set-audio-analysis", { detail: report }),
      );
    });

    await panel.getByRole("button", { name: "Merge into Suno v5.5 Style →" }).click();

    const toast = page.getByTestId("action-toast");
    await expect(toast).toBeVisible();
    await expect(toast).toContainText(/Audio → Suno v5\.5 Style merged/i);

    await expectSunoFieldCopies(page, context, { stylePattern: /MG:melodic techno/ });
  });
});
