import { test, expect } from "@playwright/test";
import {
  dismissSplash,
  saveLoadPanel,
  selectSunoEngine,
} from "./helpers.js";

const BUNDLE_FIXTURE = "tests/fixtures/e2e-import-project-bundle-vocal-align.json";

test.describe("Step coach Maestro vocal handoff", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "ai_music_creator_co_producer_llm_v1",
        JSON.stringify({
          enabled: true,
          apiKey: "e2e-test-key",
          apiUrl: "https://api.openai.com/v1/chat/completions",
          model: "gpt-4o-mini",
        }),
      );
    });
  });

  test("coach suggests Maestro vocal handoff when LLM is enabled", async ({ page }) => {
    await dismissSplash(page);
    await selectSunoEngine(page);

    const panel = saveLoadPanel(page);
    await panel.locator('input[type="file"][accept="application/json"]').setInputFiles(BUNDLE_FIXTURE);

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

    const coach = page.getByTestId("guided-step-coach");
    await expect(coach).toBeVisible({ timeout: 5000 });
    await expect(coach.getByText("Ask Maestro to export vocal handoff")).toBeVisible();
    await expect(coach.getByText("Ask Maestro about OpenVPI .ds")).toBeVisible();

    const row = coach.locator("div").filter({ hasText: "Ask Maestro about OpenVPI .ds" }).first();
    await row.getByRole("button", { name: "Apply" }).click();

    const maestro = page.getByTestId("maestro-chat-panel");
    await expect(maestro).toBeVisible();
    await expect(maestro.locator("textarea").first()).toHaveValue("show openvpi ds");
    await expect(page.getByTestId("action-toast")).toContainText(/Maestro prompt ready/i);
  });
});
