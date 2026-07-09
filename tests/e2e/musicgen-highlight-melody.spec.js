import { test, expect, request } from "@playwright/test";
import {
  analyzerPanel,
  dismissSplash,
  patchAudioAnalysisHighlight,
  selectSunoEngine,
  uploadAnalyzerAudioFixture,
} from "./helpers.js";

const ANALYZER_FIXTURE = "tests/fixtures/e2e-analyzer-tone.wav";

test.describe("MusicGen highlight melody e2e", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    const ctx = await request.newContext();
    let generateAvailable = false;
    try {
      const res = await ctx.get("http://127.0.0.1:8723/health");
      if (res.ok()) {
        const body = await res.json();
        generateAvailable = !!body.generate_available;
      }
    } catch {
      generateAvailable = false;
    }
    await ctx.dispose();
    test.skip(
      !generateAvailable,
      "MusicGen extra not installed — run npm run sidecar:generate and restart sidecar",
    );
  });

  test("highlight-region melody generate merges MG line into Style", async ({ page }) => {
    test.setTimeout(180_000);

    await dismissSplash(page);
    await selectSunoEngine(page);

    const panel = analyzerPanel(page);
    await panel.scrollIntoViewIfNeeded();
    await expect(panel.getByText("MusicGen: ready")).toBeVisible({ timeout: 30_000 });

    await uploadAnalyzerAudioFixture(panel, ANALYZER_FIXTURE, "e2e-analyzer-tone.wav");
    await patchAudioAnalysisHighlight(page, { highlightStart: 0.5, highlightEnd: 2.5 });

    const melodyCheckbox = panel.getByLabel("Condition on current track audio (melody mode)");
    await expect(melodyCheckbox).toBeVisible({ timeout: 10_000 });
    await melodyCheckbox.check();

    const highlightCheckbox = panel.getByLabel("Use waveform highlight region only");
    await expect(highlightCheckbox).toBeEnabled();
    await highlightCheckbox.check();

    await panel.locator("label").filter({ hasText: "Duration" }).locator("select").selectOption("5");
    await panel.getByRole("button", { name: "Generate & play" }).click();

    const toast = page.getByTestId("action-toast");
    await expect(toast).toBeVisible({ timeout: 15_000 });
    await expect(toast).toContainText(/MusicGen preview merged.*melody.*highlight/i, {
      timeout: 180_000,
    });

    const validator = page.locator("section").filter({ hasText: "Suno-like Validator" });
    await expect(validator).toContainText(/MG:/);
  });
});
