import { test, expect } from "@playwright/test";
import { dismissSplash } from "./helpers.js";

test("Co-Producer Generate Lyrics produces style-tagged draft", async ({ page }) => {
  await dismissSplash(page);

  await page.getByRole("button", { name: "Male Lead" }).first().click();
  await page.getByTestId("co-producer-generate-lyrics").first().click();

  const lyricsBox = page.locator("textarea").first();
  await expect(lyricsBox).toBeVisible({ timeout: 15000 });
  await expect(lyricsBox).toHaveValue(/\[Style:/, { timeout: 5000 });
  await expect(lyricsBox).toHaveValue(/\[Verse 1/, { timeout: 5000 });
});
