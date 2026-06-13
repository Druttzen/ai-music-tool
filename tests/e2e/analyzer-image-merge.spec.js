import { test, expect } from "@playwright/test";
import {
  analyzerPanel,
  dismissSplash,
  expectSunoFieldCopies,
  selectSunoEngine,
} from "./helpers.js";

const IMAGE_FIXTURE = "tests/fixtures/e2e-analyzer-palette.png";

test.describe("Image analyzer e2e", () => {
  test("drop image, merge into Suno fields, copy Style and Lyrics", async ({ page, context }) => {
    await dismissSplash(page);
    await selectSunoEngine(page);

    const panel = analyzerPanel(page);
    await panel.scrollIntoViewIfNeeded();

    await panel.locator('input[type="file"][accept*="image/png"]').setInputFiles(IMAGE_FIXTURE);

    await expect(panel.getByRole("img", { name: "Image preview" })).toBeVisible({ timeout: 30000 });
    await expect(
      panel.getByRole("button", { name: "Add image style to Suno (merge) → next step" }),
    ).toBeVisible();

    await panel.getByRole("button", { name: "Add image style to Suno (merge) → next step" }).click();

    const toast = page.getByTestId("action-toast");
    await expect(toast).toBeVisible();
    await expect(toast).toContainText(/Image style merged/i);

    const validator = page.locator("section").filter({ hasText: "Suno-like Validator" });
    await expect(validator).toContainText(/Style:\s*[1-9]\d*\s*\/\s*1000/);

    await expectSunoFieldCopies(page, context, { stylePattern: /IMAGE:/ });
  });
});
