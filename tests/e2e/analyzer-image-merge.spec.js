import { test, expect } from "@playwright/test";

const IMAGE_FIXTURE = "tests/fixtures/e2e-analyzer-palette.png";

async function dismissSplash(page) {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const skip = page.getByRole("button", { name: "Skip intro" });
  if (await skip.isVisible().catch(() => false)) {
    await skip.click();
  } else {
    await page.keyboard.press("Escape").catch(() => {});
    await page.locator("body").click({ position: { x: 8, y: 8 }, force: true }).catch(() => {});
  }
}

async function selectSunoEngine(page) {
  const coPanel = page.locator("section").filter({ hasText: "Co‑Producer AI" });
  await coPanel.locator("label").filter({ hasText: "Prompt Engine" }).locator("select").selectOption("Suno-like");
}

function analyzerPanel(page) {
  return page
    .locator("section.rounded-3xl")
    .filter({ has: page.getByRole("heading", { name: "Drag & Drop Analyzers" }) });
}

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

    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    await page.getByRole("button", { name: "Copy Style box" }).click();
    await expect(toast).toContainText(/Suno Style box copied/i);
    const styleClipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(styleClipboard.length).toBeGreaterThan(20);
    expect(styleClipboard).toMatch(/IMAGE:/);

    await page.getByRole("button", { name: "Copy Lyrics field" }).click();
    await expect(toast).toContainText(/Suno Lyrics field copied/i);
    const lyricsClipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(lyricsClipboard.length).toBeGreaterThan(0);
  });
});
