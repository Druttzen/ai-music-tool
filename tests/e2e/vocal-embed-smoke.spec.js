import { test, expect, request } from "@playwright/test";
import {
  analyzerPanel,
  dismissSplash,
  expectToast,
  saveLoadPanel,
  uploadAnalyzerAudioFixture,
  vocalEmbedStudioPanel,
} from "./helpers.js";

const PROJECT_FIXTURE = "tests/fixtures/e2e-import-project-with-character-presets.json";

const INSTRUMENTAL_FIXTURE = "tests/fixtures/e2e-analyzer-tone.wav";
const GUIDE_VOCAL_FIXTURE = "tests/fixtures/e2e-vocal-lead.wav";

test.describe("Vocal Embed sidecar smoke", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    const ctx = await request.newContext();
    let ok = false;
    try {
      const health = await ctx.get("http://127.0.0.1:8723/health");
      const models = await ctx.get("http://127.0.0.1:8723/vocal-embed/models");
      ok = health.ok() && models.ok();
    } catch {
      ok = false;
    }
    await ctx.dispose();
    test.skip(!ok, "AI sidecar not running — use npm run test:smoke:vocal");
  });

  test("validates vocal embed plan after instrumental + guide vocal upload", async ({ page }) => {
    await dismissSplash(page);

    const saveLoad = saveLoadPanel(page);
    await saveLoad.locator('input[type="file"][accept="application/json"]').setInputFiles(PROJECT_FIXTURE);
    await expectToast(page, /Imported project bundle/i);

    const analyzers = analyzerPanel(page);
    await analyzers.scrollIntoViewIfNeeded();
    await expect(analyzers.getByText("librosa ready")).toBeVisible({ timeout: 20_000 });
    await uploadAnalyzerAudioFixture(analyzers, INSTRUMENTAL_FIXTURE, "e2e-analyzer-tone.wav");

    const vocalEmbed = vocalEmbedStudioPanel(page);
    await vocalEmbed.scrollIntoViewIfNeeded();
    await expect(vocalEmbed.getByRole("heading", { name: "Vocal Embed Studio" })).toBeVisible();

    await vocalEmbed.getByRole("button", { name: /Attach guide vocal file/i }).click();
    await vocalEmbed.locator('input[type="file"][accept*="audio/wav"]').setInputFiles(GUIDE_VOCAL_FIXTURE);
    await vocalEmbed
      .locator("textarea")
      .fill("[Verse]\nSmoke test line\n\n[Chorus]\nHook line");

    await expect(vocalEmbed.getByRole("button", { name: /Send plan to sidecar/i })).toBeEnabled({
      timeout: 10_000,
    });
    await vocalEmbed.getByRole("button", { name: /Send plan to sidecar/i }).click();
    await expectToast(page, /Accepted vocal embed plan|Vocal embed|synthesis/i);
  });
});
