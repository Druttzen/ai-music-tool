import { test, expect } from "@playwright/test";
import {
  clearProjectStorage,
  dismissSplash,
  lyricStylePanel,
  moodPanel,
  sectionDawPanel,
  setMoodSlider,
} from "./helpers.js";

test.describe("Section DAW mood metatags", () => {
  test.beforeEach(async ({ page }) => {
    await clearProjectStorage(page);
  });

  test("insert metatag scaffold uses dark mood delivery tags", async ({ page }) => {
    await dismissSplash(page);

    await moodPanel(page).scrollIntoViewIfNeeded();
    await setMoodSlider(page, "Darkness", 80);

    const daw = sectionDawPanel(page);
    await daw.scrollIntoViewIfNeeded();
    await daw.getByRole("button", { name: "Insert metatag scaffold" }).click();

    const lyrics = lyricStylePanel(page).locator("textarea").first();
    await expect(lyrics).toBeVisible({ timeout: 10_000 });
    await expect(lyrics).toContainText("[Whispered]");
    await expect(lyrics).toContainText("[Intimate]");
  });
});
