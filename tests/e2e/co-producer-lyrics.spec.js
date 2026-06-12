import { test, expect } from "@playwright/test";

test("Co-Producer Generate Lyrics produces style-tagged draft", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  await page.keyboard.press("Escape").catch(() => {});
  await page.locator("body").click({ position: { x: 8, y: 8 }, force: true }).catch(() => {});

  await page.getByRole("button", { name: "Male Lead" }).first().click();
  await page.getByTestId("co-producer-generate-lyrics").first().click();

  const lyricsBox = page.locator("textarea").first();
  await expect(lyricsBox).toBeVisible({ timeout: 15000 });
  await expect(lyricsBox).toHaveValue(/\[Style:/, { timeout: 5000 });
  await expect(lyricsBox).toHaveValue(/\[Verse 1\]/);
});
