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

  test("Export Bundle includes vocalEmbed when align preview is stored", async ({ page }) => {
    await dismissSplash(page);

    await page.evaluate(() => {
      localStorage.setItem(
        "ai_music_creator_vocal_align_preview",
        JSON.stringify({
          instrumentalName: "beat.wav",
          guideName: "guide.wav",
          preview: { align_method: "heuristic", word_count: 3, sections: [] },
        }),
      );
    });

    const panel = saveLoadPanel(page);
    const downloadPromise = page.waitForEvent("download");
    await panel.getByRole("button", { name: "Export Bundle" }).click();
    await expectToast(page, /includes vocal align preview/i);

    const download = await downloadPromise;
    const raw = JSON.parse(fs.readFileSync(await download.path(), "utf8"));
    expect(raw.vocalEmbed?.preview?.align_method).toBe("heuristic");
    expect(raw.vocalEmbed?.instrumentalName).toBe("beat.wav");
  });

  test("Import Bundle restores vocal align preview to localStorage", async ({ page }) => {
    await dismissSplash(page);

    const panel = saveLoadPanel(page);
    await panel
      .locator('input[type="file"][accept="application/json"]')
      .setInputFiles("tests/fixtures/e2e-import-project-bundle-vocal-align.json");

    await expectToast(page, /vocal align preview/i);

    const stored = await page.evaluate(() =>
      localStorage.getItem("ai_music_creator_vocal_align_preview"),
    );
    expect(stored).toContain("heuristic");
    expect(stored).toContain("e2e-analyzer-tone.wav");
    expect(stored).toContain("openvpi-ds-segments");
  });

  test("Export Bundle includes openvpiDs when align and analyzed track are ready", async ({ page }) => {
    await dismissSplash(page);

    const panel = saveLoadPanel(page);
    await panel
      .locator('input[type="file"][accept="application/json"]')
      .setInputFiles("tests/fixtures/e2e-import-project-bundle-vocal-align.json");

    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent("aimc-e2e-set-audio-analysis", {
          detail: {
            fileName: "e2e-analyzer-tone.wav",
            duration: 120,
            estimatedBpm: "120 BPM",
            estimatedKey: "Am",
            peaks: Array.from({ length: 32 }, (_, i) => Math.sin(i / 6)),
          },
        }),
      );
    });

    const downloadPromise = page.waitForEvent("download");
    await panel.getByRole("button", { name: "Export Bundle" }).click();
    await expectToast(page, /OpenVPI \.ds/i);

    const download = await downloadPromise;
    const raw = JSON.parse(fs.readFileSync(await download.path(), "utf8"));
    expect(raw.vocalEmbed?.openvpiDs?.segment_count).toBeGreaterThan(0);
  });
});
