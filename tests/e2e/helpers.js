import { expect } from "@playwright/test";

export async function dismissSplash(page) {
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

export async function selectSunoEngine(page) {
  const coPanel = coProducerPanel(page);
  await coPanel.locator("label").filter({ hasText: "Prompt Engine" }).locator("select").selectOption("Suno-like");
}

export function analyzerPanel(page) {
  return page
    .locator("section.rounded-3xl")
    .filter({ has: page.getByRole("heading", { name: "Drag & Drop Analyzers" }) });
}

export function coProducerPanel(page) {
  return page.locator("section").filter({ hasText: "Co‑Producer AI" });
}

export function musicControlsPanel(page) {
  return page.locator("section").filter({ hasText: "Step 3 — Clickable Music Controls" });
}

export function lyricStylePanel(page) {
  return page.locator("section").filter({ hasText: "Lyric Style Generator" });
}

export function guidedSunoPanel(page) {
  return page.locator("section.rounded-3xl").filter({
    has: page.getByRole("navigation", { name: "Suno guided steps" }),
  });
}

export async function expectToast(page, textPattern) {
  const toast = page.getByTestId("action-toast");
  await expect(toast).toBeVisible();
  await expect(toast).toContainText(textPattern);
  await expect(toast).toHaveAttribute("data-toast-type", /.+/);
}

/** Assert Style + Lyrics copy after analyzer merge (clipboard permissions required). */
export async function expectSunoFieldCopies(page, context, { stylePattern }) {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);

  const toast = page.getByTestId("action-toast");
  await page.getByRole("button", { name: "Copy Style box" }).click();
  await expect(toast).toContainText(/Suno Style box copied/i);
  const styleClipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(styleClipboard.length).toBeGreaterThan(20);
  expect(styleClipboard).toMatch(stylePattern);

  await page.getByRole("button", { name: "Copy Lyrics field" }).click();
  await expect(toast).toContainText(/Suno Lyrics field copied/i);
  const lyricsClipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(lyricsClipboard.length).toBeGreaterThan(0);
}
