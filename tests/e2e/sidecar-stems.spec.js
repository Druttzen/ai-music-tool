import { test, expect, request } from "@playwright/test";
import { analyzerPanel, dismissSplash, uploadAnalyzerAudioFixture } from "./helpers.js";

const ANALYZER_FIXTURE = "tests/fixtures/e2e-analyzer-tone.wav";
const FIXTURE_NAME = "e2e-analyzer-tone.wav";

test.describe("Sidecar Demucs stems (requires stems extra)", () => {
  test.describe.configure({ mode: "serial", timeout: 300_000 });

  test.beforeAll(async () => {
    const ctx = await request.newContext();
    let stemsAvailable = false;
    try {
      const res = await ctx.get("http://127.0.0.1:8723/health");
      if (res.ok()) {
        const body = await res.json();
        stemsAvailable = body.stems_available === true;
      }
    } catch {
      stemsAvailable = false;
    }
    await ctx.dispose();
    test.skip(
      !stemsAvailable,
      "Sidecar stems extra not installed — run: npm run sidecar:stems && npm run test:smoke:stems",
    );
  });

  test("separates stems and shows per-stem download buttons", async ({ page }) => {
    await dismissSplash(page);

    const panel = analyzerPanel(page);
    await panel.scrollIntoViewIfNeeded();

    await expect(panel.getByText("librosa ready")).toBeVisible({ timeout: 20_000 });

    await uploadAnalyzerAudioFixture(panel, ANALYZER_FIXTURE, FIXTURE_NAME);

    await panel.getByRole("button", { name: "Separate stems (Demucs)" }).click();

    const toast = page.getByTestId("action-toast");
    await expect(toast).toContainText(/Stems ready|stem separation|Re-attach/i, { timeout: 300_000 });

    await expect(panel.getByRole("button", { name: /↓ vocals/i })).toBeVisible({
      timeout: 60_000,
    });
    await expect(panel.getByRole("button", { name: /↓ drums/i })).toBeVisible();
  });
});
