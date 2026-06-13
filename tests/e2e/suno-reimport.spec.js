import { test, expect } from "@playwright/test";
import {
  dismissSplash,
  expectToast,
  promptPreviewPanel,
  selectStandardEngine,
  sunoReimportPanel,
} from "./helpers.js";

async function loadTechnoCorePreset(page) {
  await page.getByRole("button", { name: "Techno Core", exact: true }).first().click();
}

test.describe("Suno re-import panel e2e", () => {
  test("paste diff, use pasted for copy, and apply pasted lyrics", async ({ page }) => {
    await dismissSplash(page);
    await selectStandardEngine(page);
    await loadTechnoCorePreset(page);

    const panel = sunoReimportPanel(page);
    await panel.scrollIntoViewIfNeeded();

    await panel.getByRole("button", { name: "Capture from project" }).click();
    await expectToast(page, /Captured current Style\/Lyrics/i);

    const styleField = panel.getByTestId("suno-reimport-style");
    const builtStyle = await styleField.inputValue();
    expect(builtStyle.length).toBeGreaterThan(10);

    await styleField.fill(`e2e darker mix, ${builtStyle}`);
    await panel.getByTestId("suno-reimport-lyrics").fill("[Club chant]\nE2E reimport lyric line");

    const diff = panel.getByTestId("suno-reimport-diff");
    await expect(diff).toBeVisible();
    await expect(panel.getByTestId("suno-reimport-diff-style")).toContainText(/differs/i);

    await panel.getByTestId("suno-reimport-use-for-copy").click();
    await expectToast(page, /Preview and copy now use pasted Suno fields/i);
    await expect(panel.getByText(/Prompt Preview and Copy Prompt use pasted Suno fields/i)).toBeVisible();

    const previewStyle = promptPreviewPanel(page).getByTestId("prompt-preview-style");
    await expect(previewStyle).toContainText(/e2e darker mix/i);

    await panel.getByTestId("suno-reimport-apply-lyrics").click();
    await expectToast(page, /Applied pasted Lyrics to generated lyrics/i);

    const coPanel = page.locator("section").filter({ hasText: "Co‑Producer AI" });
    await expect(coPanel.locator("textarea").filter({ hasText: "E2E reimport lyric line" }).first()).toBeVisible();
  });
});
