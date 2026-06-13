import { test, expect } from "@playwright/test";
import fs from "node:fs";
import {
  clearProjectStorage,
  dismissSplash,
  expectToast,
  ideaInput,
  musicControlsPanel,
  saveLoadPanel,
  skipSplashIfVisible,
} from "./helpers.js";

const BUNDLE_FIXTURE = "tests/fixtures/e2e-import-project-bundle.json";

test.describe("project bundle e2e", () => {
  test.beforeEach(async ({ page }) => {
    await clearProjectStorage(page);
  });

  test("Import Bundle restores project fields and merges custom presets", async ({ page }) => {
    await dismissSplash(page);

    const panel = saveLoadPanel(page);
    await panel.locator('input[type="file"][accept="application/json"]').setInputFiles(BUNDLE_FIXTURE);

    await expectToast(page, /Imported project bundle/i);
    await expect(ideaInput(page)).toHaveValue("Imported from bundle fixture");

    const controls = musicControlsPanel(page);
    await expect(controls.getByRole("button", { name: "House", exact: true })).toHaveClass(/border-cyan-300/);
    await expect(controls.getByRole("button", { name: "Female Lead", exact: true })).toHaveClass(
      /border-cyan-300/,
    );

    const presetsPanel = page.locator("section").filter({ hasText: "Style Presets" });
    await expect(presetsPanel.getByRole("button", { name: "E2E Bundle Preset", exact: true })).toBeVisible();

    const storedPresets = await page.evaluate(() =>
      localStorage.getItem("ai_music_creator_custom_presets_v1"),
    );
    expect(storedPresets).toContain("E2E Bundle Preset");

    await expect(page.locator("header").getByText(/Autosaved at/i)).toBeVisible({ timeout: 8000 });

    await page.reload();
    await page.waitForLoadState("networkidle");
    await skipSplashIfVisible(page);

    await expect(presetsPanel.getByRole("button", { name: "E2E Bundle Preset", exact: true })).toBeVisible({
      timeout: 8000,
    });
  });

  test("Export Bundle downloads ai-music-creator-bundle JSON", async ({ page }) => {
    await dismissSplash(page);

    const panel = saveLoadPanel(page);
    await ideaInput(page).fill("Export bundle marker");

    const presetsPanel = page.locator("section").filter({ hasText: "Style Presets" });
    await presetsPanel.locator('input[placeholder="Preset name..."]').fill("E2E Saved Preset");
    await presetsPanel.getByRole("button", { name: "Save As Preset" }).click();
    await expectToast(page, /Saved preset: E2E Saved Preset/i);

    const downloadPromise = page.waitForEvent("download");
    await panel.getByRole("button", { name: "Export Bundle" }).click();
    await expectToast(page, /Exported project bundle/i);

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("ai-music-bundle.json");

    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    const raw = JSON.parse(fs.readFileSync(downloadPath, "utf8"));

    expect(raw.bundleFormat).toBe("ai-music-creator-bundle");
    expect(raw.project.idea).toBe("Export bundle marker");
    expect(raw.customPresets["E2E Saved Preset"]).toBeTruthy();
  });
});
