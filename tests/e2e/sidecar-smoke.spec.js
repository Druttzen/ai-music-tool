import { test, expect, request } from "@playwright/test";
import { analyzerPanel, dismissSplash, uploadAnalyzerAudioFixture } from "./helpers.js";

const ANALYZER_FIXTURE = "tests/fixtures/e2e-analyzer-tone.wav";
const FIXTURE_NAME = "e2e-analyzer-tone.wav";

test.describe("Sidecar UI smoke", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeAll(async () => {
    const ctx = await request.newContext({ timeout: 5_000 });
    let ok = false;
    try {
      const res = await ctx.get("http://127.0.0.1:8723/health");
      ok = res.ok();
    } catch {
      ok = false;
    }
    if (ok) {
      try { ok = (await ctx.get("http://127.0.0.1:8723/jobs/e2e-access-probe")).status() === 404; }
      catch { ok = false; }
    }
    await ctx.dispose();
    test.skip(
      !ok,
      "AI sidecar not running on http://127.0.0.1:8723 — use npm run test:smoke or start the sidecar",
    );
  });

  test("shows librosa ready badge and enriches track report via sidecar", async ({ page }) => {
    await dismissSplash(page);

    const panel = analyzerPanel(page);
    await panel.scrollIntoViewIfNeeded();

    await expect(panel.getByText("librosa ready")).toBeVisible({ timeout: 20_000 });

    await uploadAnalyzerAudioFixture(panel, ANALYZER_FIXTURE, FIXTURE_NAME);

    await expect(panel.getByText(/local librosa analysis \(Python sidecar\)/i)).toBeVisible({
      timeout: 30_000,
    });
  });

  test("Demucs stem separation shows graceful error when stems extra is missing", async ({ page }) => {
    // Exercise the missing-plugin response even on machines with Demucs installed.
    await page.route("**/separate", (route) => route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ detail: "Stem separation unavailable: install the stems extra" }),
    }));
    await dismissSplash(page);

    const panel = analyzerPanel(page);
    await panel.scrollIntoViewIfNeeded();

    await expect(panel.getByText("librosa ready")).toBeVisible({ timeout: 20_000 });

    await uploadAnalyzerAudioFixture(panel, ANALYZER_FIXTURE, FIXTURE_NAME);

    await panel.getByRole("combobox", { name: "Stem separation model" }).selectOption("htdemucs");
    await panel.getByRole("button", { name: "Separate stems (Demucs)" }).click();

    const toast = page.getByTestId("action-toast");
    await expect(toast).toBeVisible({ timeout: 15_000 });
    await expect(toast).toContainText(/stem separation unavailable|stems.*extra/i);
  });
});
