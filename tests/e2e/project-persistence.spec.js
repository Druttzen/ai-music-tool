import { test, expect } from "@playwright/test";
import {
  clearProjectStorage,
  dismissSplash,
  expectToast,
  ideaInput,
  musicControlsPanel,
  saveLoadPanel,
  skipSplashIfVisible,
  voiceCharacterStudioPanel,
  waitForAutosavedMarker,
} from "./helpers.js";

const IMPORT_FIXTURE = "tests/fixtures/e2e-import-project.json";

test.describe("Project persistence e2e", () => {
  test.beforeEach(async ({ page }) => {
    await clearProjectStorage(page);
  });

  test("Import JSON restores fixture fields in the UI", async ({ page }) => {
    await dismissSplash(page);

    const panel = saveLoadPanel(page);
    await panel.locator('input[type="file"][accept="application/json"]').setInputFiles(IMPORT_FIXTURE);

    await expectToast(page, /Imported project bundle/i);
    await expect(ideaInput(page)).toHaveValue("Imported from P14 fixture");

    const controls = musicControlsPanel(page);
    const afrobeats = controls.getByRole("button", { name: "Afrobeats", exact: true });
    await expect(afrobeats).toHaveClass(/border-cyan-300/);
    await expect(controls.getByRole("button", { name: "Male Lead", exact: true })).toHaveClass(
      /border-cyan-300/,
    );
  });

  test("Revert to last snapshot restores state captured before preset load", async ({ page }) => {
    await dismissSplash(page);

    const panel = saveLoadPanel(page);
    await panel.locator('input[type="file"][accept="application/json"]').setInputFiles(IMPORT_FIXTURE);
    await expect(ideaInput(page)).toHaveValue("Imported from P14 fixture");

    const controls = musicControlsPanel(page);
    const afrobeats = controls.getByRole("button", { name: "Afrobeats", exact: true });
    await expect(afrobeats).toHaveClass(/border-cyan-300/);

    const presetsPanel = page.locator("section").filter({ hasText: "Style Presets" });
    await presetsPanel.getByRole("button", { name: "Techno Core", exact: true }).click();
    await expectToast(page, /Loaded preset: Techno Core/i);

    const techno = controls.getByRole("button", { name: "Techno", exact: true });
    await expect(techno).toHaveClass(/border-cyan-300/);
    await expect(afrobeats).not.toHaveClass(/border-cyan-300/);
    await expect(ideaInput(page)).toHaveValue("Imported from P14 fixture");

    await panel.getByRole("button", { name: "Revert to last snapshot" }).click();
    await expectToast(page, /Reverted to last snapshot/i);

    await expect(afrobeats).toHaveClass(/border-cyan-300/);
    await expect(techno).not.toHaveClass(/border-cyan-300/);
    await expect(ideaInput(page)).toHaveValue("Imported from P14 fixture");
  });

  test("Autosave persists edits across reload", async ({ page }) => {
    await dismissSplash(page);

    const marker = "Autosave reload marker P14";
    await ideaInput(page).fill(marker);

    await waitForAutosavedMarker(page, marker);

    await page.reload();
    await page.waitForLoadState("networkidle");
    await skipSplashIfVisible(page);

    await expect(ideaInput(page)).toHaveValue(marker, { timeout: 5000 });
  });

  test("project JSON with characterVoicePresets survives reload", async ({ page }) => {
    const fixture = "tests/fixtures/e2e-import-project-with-character-presets.json";

    await dismissSplash(page);

    const panel = saveLoadPanel(page);
    await panel.locator('input[type="file"][accept="application/json"]').setInputFiles(fixture);
    await expectToast(page, /Imported project bundle/i);
    await expect(ideaInput(page)).toHaveValue("Imported with character voice presets");

    const studio = voiceCharacterStudioPanel(page);
    await studio.scrollIntoViewIfNeeded();
    await expect(studio.getByText("E2E Narrator", { exact: true })).toBeVisible();

    await page.reload();
    await page.waitForLoadState("networkidle");
    await skipSplashIfVisible(page);

    await expect(studio.getByText("E2E Narrator", { exact: true })).toBeVisible({ timeout: 5000 });
  });

  test("revert snapshot restores project state before character preset import", async ({ page }) => {
    await dismissSplash(page);

    const panel = saveLoadPanel(page);
    await panel.locator('input[type="file"][accept="application/json"]').setInputFiles(IMPORT_FIXTURE);
    await expect(ideaInput(page)).toHaveValue("Imported from P14 fixture");

    const studio = voiceCharacterStudioPanel(page);
    await studio.scrollIntoViewIfNeeded();
    await studio
      .locator('input[type="file"][accept="application/json"]')
      .setInputFiles("tests/fixtures/e2e-character-voice-presets.json");
    await expectToast(page, /Imported 1 character preset/i);
    await expect(studio.getByText("E2E Narrator", { exact: true })).toBeVisible();

    await panel.getByRole("button", { name: "Revert to last snapshot" }).click();
    await expectToast(page, /Reverted to last snapshot/i);

    await expect(studio.getByText("E2E Narrator", { exact: true })).not.toBeVisible();
    await expect(ideaInput(page)).toHaveValue("Imported from P14 fixture");
  });

  test("project JSON with characterVoiceStudioSession restores studio UI after reload", async ({ page }) => {
    const fixture = "tests/fixtures/e2e-import-project-with-character-presets.json";

    await dismissSplash(page);

    const panel = saveLoadPanel(page);
    await panel.locator('input[type="file"][accept="application/json"]').setInputFiles(fixture);
    await expectToast(page, /Imported project bundle/i);

    const studio = voiceCharacterStudioPanel(page);
    await studio.scrollIntoViewIfNeeded();
    await expect(studio.locator(".font-bold.text-cyan-200")).toContainText(/baritone register/i);
    await expect(studio.locator('input[placeholder="e.g. Warm baritone narrator"]')).toHaveValue("E2E Narrator");
    await expect(studio.getByPlaceholder(/youtube\.com\/watch/i)).toHaveValue(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );

    await page.reload();
    await page.waitForLoadState("networkidle");
    await skipSplashIfVisible(page);

    await expect(studio.locator(".font-bold.text-cyan-200")).toContainText(/baritone register/i, {
      timeout: 5000,
    });
    await expect(studio.locator('input[placeholder="e.g. Warm baritone narrator"]')).toHaveValue("E2E Narrator");
    await expect(studio.getByPlaceholder(/youtube\.com\/watch/i)).toHaveValue(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
  });

  test("Reset to Default clears voice studio session but keeps saved character presets", async ({ page }) => {
    const fixture = "tests/fixtures/e2e-import-project-with-character-presets.json";

    await dismissSplash(page);

    const panel = saveLoadPanel(page);
    await panel.locator('input[type="file"][accept="application/json"]').setInputFiles(fixture);
    await expectToast(page, /Imported project bundle/i);

    const studio = voiceCharacterStudioPanel(page);
    await studio.scrollIntoViewIfNeeded();
    await expect(studio.locator(".font-bold.text-cyan-200")).toContainText(/baritone register/i);
    await expect(studio.getByText("E2E Narrator", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Reset to Default" }).click();
    await expect(page.locator("header").getByText(/blank slate on guided step 1/i)).toBeVisible();

    await expect(studio.locator(".font-bold.text-cyan-200")).toHaveCount(0);
    await expect(studio.locator('input[placeholder="e.g. Warm baritone narrator"]')).toHaveValue("");
    await expect(studio.getByPlaceholder(/youtube\.com\/watch/i)).toHaveValue("");
    await expect(studio.getByText("E2E Narrator", { exact: true })).toBeVisible();
  });
});
