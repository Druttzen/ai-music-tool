import { test, expect } from "@playwright/test";
import {
  dismissSplash,
  lyricStylePanel,
  promptPreviewPanel,
  selectSunoEngine,
  selectStandardEngine,
} from "./helpers.js";

async function loadTechnoCorePreset(page) {
  await page.getByRole("button", { name: "Techno Core", exact: true }).first().click();
}

const INTERNAL_STYLE_MARKERS = [/DNA:/, /\bsounds:/i, /^STYLE:/m, /^RULES:/m, /^SOUND:/m];
const INTERNAL_LYRICS_MARKERS = [/\btheme:/i, /LYRIC STYLE/i, /^Language:/m];

async function expectPasteReadyStyle(pre) {
  await expect(pre).toBeVisible();
  const text = await pre.textContent();
  expect(text?.length).toBeGreaterThan(10);
  for (const pattern of INTERNAL_STYLE_MARKERS) {
    expect(text).not.toMatch(pattern);
  }
}

async function expectPasteReadyLyrics(pre) {
  await expect(pre).toBeVisible();
  const text = (await pre.textContent()) || "";
  for (const pattern of INTERNAL_LYRICS_MARKERS) {
    expect(text).not.toMatch(pattern);
  }
}

test.describe("paste-ready prompt previews e2e", () => {
  test("Standard engine Prompt Preview uses paste-ready Style and Lyrics blocks", async ({ page }) => {
    await dismissSplash(page);
    await selectStandardEngine(page);
    await loadTechnoCorePreset(page);

    const preview = promptPreviewPanel(page);
    await expectPasteReadyStyle(preview.getByTestId("prompt-preview-style"));
    await expectPasteReadyLyrics(preview.getByTestId("prompt-preview-lyrics"));
    await expect(preview.getByTestId("prompt-preview-style")).toContainText(/Techno/i);
  });

  test("Suno-like Prompt Preview uses paste-ready Style and Lyrics blocks", async ({ page }) => {
    await dismissSplash(page);
    await selectSunoEngine(page);
    await loadTechnoCorePreset(page);

    const preview = promptPreviewPanel(page);
    await expectPasteReadyStyle(preview.getByTestId("prompt-preview-style"));
    await expectPasteReadyLyrics(preview.getByTestId("prompt-preview-lyrics"));
    await expect(preview.getByTestId("prompt-preview-style")).toContainText(/Techno/i);
  });

  test("Lyric Style panel preview has no direction meta prefixes", async ({ page }) => {
    await dismissSplash(page);
    await page.getByRole("button", { name: "Male Lead" }).first().click();

    const panel = lyricStylePanel(page);
    await panel.locator("label").filter({ hasText: "Lyric Theme" }).locator("input").fill("night drive");

    const pre = panel.getByTestId("lyric-field-preview");
    await expect(pre).toBeVisible();
    const text = (await pre.textContent()) || "";
    expect(text).toContain("night drive");
    for (const pattern of INTERNAL_LYRICS_MARKERS) {
      expect(text).not.toMatch(pattern);
    }
    expect(text).not.toMatch(/select vocal mode/i);
  });

  test("Copy Prompt uses paste-ready text under Standard engine", async ({ page, context }) => {
    await dismissSplash(page);
    await selectStandardEngine(page);
    await loadTechnoCorePreset(page);

    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await promptPreviewPanel(page).getByRole("button", { name: "Copy Prompt" }).click();
    await expect(page.getByTestId("action-toast")).toContainText(/Prompt copied/i);

    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toMatch(/Techno/i);
    for (const pattern of [...INTERNAL_STYLE_MARKERS, ...INTERNAL_LYRICS_MARKERS]) {
      expect(clipboard).not.toMatch(pattern);
    }
  });
});
