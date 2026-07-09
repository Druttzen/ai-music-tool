import { test, expect } from "@playwright/test";
import { dismissSplash, enableGuidedShowAll, clearProjectStorage, maestroChatInput, maestroChatPanel } from "./helpers.js";

test.describe("Maestro offline chat", () => {
  test("offline Maestro replies to show the style prompt", async ({ page }) => {
    await clearProjectStorage(page);
    await dismissSplash(page);
    await enableGuidedShowAll(page);
    await page.reload();
    await page.waitForLoadState("networkidle");

    const maestro = maestroChatPanel(page);
    await expect(maestro).toBeVisible({ timeout: 15_000 });
    await maestro.scrollIntoViewIfNeeded();

    const input = maestroChatInput(page);
    await input.fill("show the style prompt");
    await maestro.getByRole("button", { name: /^Send$/i }).click();

    await expect(maestro.getByText(/style prompt|Suno|Techno|style/i).last()).toBeVisible({
      timeout: 15_000,
    });
  });
});
