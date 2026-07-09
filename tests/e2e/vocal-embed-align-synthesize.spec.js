import fs from "node:fs";
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

test.describe("Vocal Embed align & synthesize e2e", () => {
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

  async function prepareVocalEmbed(page) {
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
    await vocalEmbed.getByRole("button", { name: /Attach guide vocal file/i }).click();
    await vocalEmbed.locator('input[type="file"][accept*="audio/wav"]').setInputFiles(GUIDE_VOCAL_FIXTURE);
    await vocalEmbed
      .locator("textarea")
      .fill("[Verse]\nAlign smoke line one\n\n[Chorus]\nHook for alignment");
    return vocalEmbed;
  }

  test("preview MFA / heuristic alignment", async ({ page }) => {
    const vocalEmbed = await prepareVocalEmbed(page);

    await vocalEmbed.getByRole("button", { name: /Preview MFA \/ heuristic alignment/i }).click();
    await expectToast(page, /Alignment preview: (mfa|heuristic)/i, 30_000);
  });

  test("align and synthesize preview in one click", async ({ page }) => {
    const vocalEmbed = await prepareVocalEmbed(page);

    const alignSynth = vocalEmbed.getByRole("button", { name: /Align & synthesize preview/i });
    await expect(alignSynth).toBeEnabled({ timeout: 15_000 });
    await alignSynth.click();
    await expectToast(page, /Vocal embed preview downloaded.*align/i, 45_000);
  });

  test("align and export handoff pack includes plan align and openvpi ds", async ({ page }) => {
    const vocalEmbed = await prepareVocalEmbed(page);
    const downloads = [];
    page.on("download", (download) => downloads.push(download));

    const alignExport = vocalEmbed.getByRole("button", { name: /Align & export handoff/i });
    await expect(alignExport).toBeEnabled({ timeout: 15_000 });
    await alignExport.click();
    await expectToast(page, /Handoff pack downloaded.*OpenVPI \.ds/i, 45_000);

    await expect.poll(() => downloads.length, { timeout: 15_000 }).toBeGreaterThanOrEqual(4);

    const names = downloads.map((d) => d.suggestedFilename());
    expect(names.some((n) => n.endsWith("-plan.json"))).toBe(true);
    expect(names.some((n) => n.endsWith("-align-preview.json"))).toBe(true);
    expect(names.some((n) => n.endsWith("-openvpi-ds.json"))).toBe(true);
    expect(names.some((n) => n.endsWith("-README.txt"))).toBe(true);

    const dsIndex = names.findIndex((n) => n.includes("openvpi-ds"));
    const dsPath = await downloads[dsIndex].path();
    const dsJson = JSON.parse(fs.readFileSync(dsPath, "utf8"));
    expect(dsJson.format).toBe("openvpi-ds-segments");
    expect(dsJson.segment_count).toBeGreaterThan(0);
  });
});
