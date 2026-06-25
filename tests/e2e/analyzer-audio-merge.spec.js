import { test, expect } from "@playwright/test";
import {
  analyzerPanel,
  dismissSplash,
  expectSunoFieldCopies,
  selectSunoEngine,
  uploadAnalyzerAudioFixture,
} from "./helpers.js";

const ANALYZER_FIXTURE = "tests/fixtures/e2e-analyzer-tone.wav";

test.describe("Audio analyzer e2e", () => {
  test("drop audio, merge into Suno fields, copy Style and Lyrics", async ({ page, context }) => {
    await dismissSplash(page);
    await selectSunoEngine(page);

    const panel = analyzerPanel(page);
    await panel.scrollIntoViewIfNeeded();

    await uploadAnalyzerAudioFixture(panel, ANALYZER_FIXTURE, "e2e-analyzer-tone.wav");

    await panel.getByRole("button", { name: "Merge into Suno fields →" }).click();

    const toast = page.getByTestId("action-toast");
    await expect(toast).toBeVisible();
    await expect(toast).toContainText(/Audio DNA merged/i);

    const validator = page.locator("section").filter({ hasText: "Suno-like Validator" });
    await expect(validator).toContainText(/Style:\s*[1-9]\d*\s*\/\s*1000/);

    await expectSunoFieldCopies(page, context, { stylePattern: /AUDIO:/ });
  });
});
