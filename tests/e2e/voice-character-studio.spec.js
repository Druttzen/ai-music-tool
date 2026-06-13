import { test, expect } from "@playwright/test";
import {
  analyzerPanel,
  clearProjectStorage,
  dismissSplash,
  expectToast,
  musicControlsPanel,
  voiceCharacterStudioPanel,
} from "./helpers.js";

const CHARACTER_PRESETS_FIXTURE = "tests/fixtures/e2e-character-voice-presets.json";
const VOCAL_FIXTURE = "tests/fixtures/e2e-vocal-lead.wav";

test.describe("Voice Character Studio e2e", () => {
  test.beforeEach(async ({ page }) => {
    await clearProjectStorage(page);
  });

  test("import character presets JSON, load preset, and apply voice block", async ({ page }) => {
    await dismissSplash(page);

    const panel = voiceCharacterStudioPanel(page);
    await panel.scrollIntoViewIfNeeded();

    await panel.locator('input[type="file"][accept="application/json"]').setInputFiles(CHARACTER_PRESETS_FIXTURE);
    await expectToast(page, /Imported 1 character preset/i);

    await expect(panel.getByText("E2E Narrator", { exact: true })).toBeVisible();
    await panel
      .locator("div")
      .filter({ hasText: "E2E Narrator" })
      .getByRole("button", { name: "Load", exact: true })
      .click();
    await expectToast(page, /Loaded character preset: E2E Narrator/i);

    const voiceBlock = panel.locator("pre").filter({ hasText: /trait map/i }).first();
    await expect(voiceBlock).toBeVisible();
    await expect(voiceBlock).toContainText(/E2E Narrator/i);

    const controls = musicControlsPanel(page);
    await expect(controls.getByRole("button", { name: "Male Lead", exact: true })).toHaveClass(
      /border-cyan-300/,
    );
  });

  test("export character presets JSON after import", async ({ page }) => {
    await dismissSplash(page);

    const panel = voiceCharacterStudioPanel(page);
    await panel.scrollIntoViewIfNeeded();

    await panel.locator('input[type="file"][accept="application/json"]').setInputFiles(CHARACTER_PRESETS_FIXTURE);
    await expectToast(page, /Imported 1 character preset/i);

    await panel.getByRole("button", { name: "Export character presets JSON" }).click();
    await expectToast(page, /Exported 1 character preset JSON/i);
  });

  test("regenerate Suno voice block from loaded character preset", async ({ page }) => {
    await dismissSplash(page);

    const panel = voiceCharacterStudioPanel(page);
    await panel.scrollIntoViewIfNeeded();

    await panel.locator('input[type="file"][accept="application/json"]').setInputFiles(CHARACTER_PRESETS_FIXTURE);
    await panel
      .locator("div")
      .filter({ hasText: "E2E Narrator" })
      .getByRole("button", { name: "Load", exact: true })
      .click();

    await panel
      .locator("div")
      .filter({ hasText: "E2E Narrator" })
      .getByRole("button", { name: "Regenerate", exact: true })
      .click();
    await expectToast(page, /Regenerated Suno voice block from character DNA/i);
  });

  test("loading file-only preset clears linked YouTube reference", async ({ page }) => {
    await dismissSplash(page);

    const panel = voiceCharacterStudioPanel(page);
    await panel.scrollIntoViewIfNeeded();

    await panel.locator('input[type="file"][accept="application/json"]').setInputFiles(CHARACTER_PRESETS_FIXTURE);

    await panel.getByPlaceholder(/youtube\.com\/watch/i).fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    await panel.getByRole("button", { name: "Link YouTube" }).click();
    await expect(panel.getByText(/^Linked:/)).toBeVisible({ timeout: 15000 });

    await panel
      .locator("div")
      .filter({ hasText: "E2E Narrator" })
      .getByRole("button", { name: "Load", exact: true })
      .click();
    await expectToast(page, /Loaded character preset: E2E Narrator/i);

    await expect(panel.getByText(/^Linked:/)).not.toBeVisible();
    await expect(panel.getByPlaceholder(/youtube\.com\/watch/i)).toHaveValue("");
  });

  test("load preset shows compact style and lyric metatag copy blocks", async ({ page }) => {
    await dismissSplash(page);

    const panel = voiceCharacterStudioPanel(page);
    await panel.scrollIntoViewIfNeeded();

    await panel.locator('input[type="file"][accept="application/json"]').setInputFiles(CHARACTER_PRESETS_FIXTURE);
    await panel
      .locator("div")
      .filter({ hasText: "E2E Narrator" })
      .getByRole("button", { name: "Load", exact: true })
      .click();

    await expect(panel.getByText("Compact (Style box)")).toBeVisible();
    await expect(panel.getByRole("button", { name: "Copy compact style line" })).toBeVisible();
    await expect(panel.getByRole("button", { name: "Copy lyric metatag" })).toBeVisible();
    await expect(panel.locator("pre").filter({ hasText: /\[Vocal character: E2E Narrator/i })).toBeVisible();
  });

  test("analyze vocal file and show character traits", async ({ page }) => {
    await dismissSplash(page);

    const panel = voiceCharacterStudioPanel(page);
    await panel.scrollIntoViewIfNeeded();

    await panel.locator('input[type="file"][accept*="audio/wav"]').setInputFiles(VOCAL_FIXTURE);

    await expect(panel.locator(".font-bold.text-cyan-200")).toContainText(/register/i, { timeout: 30000 });
    await expectToast(page, /Voice character analyzed|Suno voice block regenerated|Weak vocal signal/i);

    await expect(panel.getByText("Generated Suno voice block")).toBeVisible();
    await expect(panel.locator("pre").last()).toContainText(/Vocal character|Suno Style direction/i);
  });

  test("track analyzer handoff runs Voice Character Studio analysis", async ({ page }) => {
    await dismissSplash(page);

    const analyzers = analyzerPanel(page);
    await analyzers.scrollIntoViewIfNeeded();
    await analyzers.locator('input[type="file"][accept*="audio/wav"]').setInputFiles(VOCAL_FIXTURE);

    await expect(analyzers.getByRole("button", { name: "Analyze vocal character →" })).toBeVisible({
      timeout: 30000,
    });

    await analyzers.getByRole("button", { name: "Analyze vocal character →" }).click();
    await expectToast(page, /Analyzing vocal character|acapella|Weak vocal signal|Voice character analyzed/i);

    const studio = voiceCharacterStudioPanel(page);
    await expect(studio.locator(".font-bold.text-cyan-200")).toContainText(/register/i, {
      timeout: 30000,
    });
  });
});
