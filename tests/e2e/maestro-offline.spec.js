import { test, expect } from "@playwright/test";
import { dismissSplash, enableGuidedShowAll } from "./helpers.js";

test.describe("Maestro offline chat", () => {
  test("offline Maestro replies to show the style prompt", async ({ page }) => {
    await dismissSplash(page);
    await enableGuidedShowAll(page);
    await page.reload();
    await page.waitForLoadState("networkidle");

    const maestro = page.getByTestId("maestro-chat-panel");
    await maestro.scrollIntoViewIfNeeded();

    const input = maestro.locator("textarea").first();
    await input.fill("show the style prompt");
    await maestro.getByRole("button", { name: /^Send$/i }).click();

    await expect(maestro.getByText(/style prompt|Suno|Techno|style/i).last()).toBeVisible({
      timeout: 15_000,
    });
  });
});
