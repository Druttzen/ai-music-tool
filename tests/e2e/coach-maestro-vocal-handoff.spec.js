import { test, expect } from "@playwright/test";
import {
  applyCoachImprovement,
  dismissSplash,
  enableGuidedStepCoach,
  expectToast,
  maestroChatInput,
  maestroChatPanel,
  saveLoadPanel,
  selectSunoEngine,
} from "./helpers.js";

const BUNDLE_FIXTURE = "tests/fixtures/e2e-import-project-bundle-vocal-align.json";

test.describe("Step coach Maestro vocal handoff", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem("ai_music_creator_guided_show_all");
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
    await enableGuidedStepCoach(page);
    await page.reload();
    await page.waitForLoadState("networkidle");

    const panel = saveLoadPanel(page);
    await panel.locator('input[type="file"][accept="application/json"]').setInputFiles(BUNDLE_FIXTURE);
    await expectToast(page, /Imported project bundle/i);

    await expect
      .poll(async () =>
        page.evaluate(() => localStorage.getItem("ai_music_creator_visual_tool_v3")?.includes("warm baritone")),
      { timeout: 10_000 })
      .toBe(true);

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

    await page.waitForTimeout(2200);

    const coach = page.getByTestId("guided-step-coach");
    await expect(coach).toBeVisible({ timeout: 12_000 });
    await expect(coach.getByText("Ask Maestro to export vocal handoff")).toBeVisible({ timeout: 12_000 });
    await expect(coach.getByText("Ask Maestro about OpenVPI .ds")).toBeVisible();

    await applyCoachImprovement(coach, "maestro-openvpi-ds");

    const maestro = maestroChatPanel(page);
    await expect(maestro).toBeVisible();
    await expect(maestroChatInput(page)).toHaveValue("show openvpi ds", { timeout: 10_000 });
    await expect(page.getByTestId("action-toast")).toContainText(/Maestro prompt ready/i);
  });
});
