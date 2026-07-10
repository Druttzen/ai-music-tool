import { test, expect } from "@playwright/test";
import {
  clearProjectStorage,
  dismissSplash,
  expectToast,
  saveLoadPanel,
  sunoProToolsPanel,
} from "./helpers.js";

const MY_TASTE_FIXTURE = "tests/fixtures/e2e-import-project-my-taste.json";
const CHARACTER_BUNDLE = "tests/fixtures/e2e-import-project-with-character-presets.json";

test.describe("Suno 5.5 Pro tools e2e", () => {
  test.beforeEach(async ({ page }) => {
    await clearProjectStorage(page);
  });

  test("My Taste profile unlocks after import with presets", async ({ page }) => {
    await dismissSplash(page);

    await saveLoadPanel(page)
      .locator('input[type="file"][accept="application/json"]')
      .setInputFiles(MY_TASTE_FIXTURE);
    await expectToast(page, /Imported project bundle/i);

    const panel = sunoProToolsPanel(page);
    await panel.scrollIntoViewIfNeeded();

    const taste = panel.getByTestId("my-taste-profile");
    await expect(taste.getByText(/\d+ project sample\(s\)/)).toBeVisible();
    await expect(taste.getByRole("button", { name: "Copy magic style" })).toBeVisible();
    await expect(taste.getByRole("button", { name: "Apply to project" })).toBeVisible();
  });

  test("Album mode shows track style lines from project sound bible", async ({ page }) => {
    await dismissSplash(page);

    await saveLoadPanel(page)
      .locator('input[type="file"][accept="application/json"]')
      .setInputFiles(CHARACTER_BUNDLE);
    await expectToast(page, /Imported project bundle/i);

    const panel = sunoProToolsPanel(page);
    await panel.scrollIntoViewIfNeeded();

    await expect(panel.getByText("Album mode")).toBeVisible();
    await expect(panel.getByText("Track 1 — Opener")).toBeVisible();
    await expect(panel.getByRole("button", { name: "Copy album JSON" })).toBeVisible();
    await expect(panel.getByRole("button", { name: "Copy sound bible" })).toBeVisible();
  });
});
