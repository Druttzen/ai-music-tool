import { test, expect } from "@playwright/test";
import {
  dismissSplash,
  enableGuidedShowAll,
  saveLoadPanel,
  selectSunoEngine,
  expectToast,
} from "./helpers.js";
import { maestroChatInput } from "./maestro-chat-input.js";

const BUNDLE_FIXTURE = "tests/fixtures/e2e-import-project-bundle-vocal-align.json";
const MOCK_LLM_URL = "https://mock-maestro-llm.test/v1/chat/completions";

test.describe("Maestro LLM vocal embed", () => {
  test.beforeEach(async ({ page }) => {
    await page.route(MOCK_LLM_URL, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  reply: "Vocal embed is staged — scrolling to the studio.",
                  patch: null,
                  commands: ["focusVocalEmbed"],
                  artifacts: null,
                  suggestions: ["Show the style prompt"],
                }),
              },
            },
          ],
        }),
      });
    });

    await page.addInitScript((url) => {
      if (sessionStorage.getItem("__e2e_llm_storage_ready__")) return;
      localStorage.clear();
      localStorage.setItem("ai_music_creator_guided_show_all", "1");
      localStorage.setItem(
        "ai_music_creator_co_producer_llm_v1",
        JSON.stringify({
          enabled: true,
          apiKey: "e2e-test-key",
          apiUrl: url,
          model: "e2e-mock",
        }),
      );
      sessionStorage.setItem("__e2e_llm_storage_ready__", "1");
    }, MOCK_LLM_URL);
  });

  test("LLM focusVocalEmbed enriches vocal embed brief offline", async ({ page }) => {
    await dismissSplash(page);
    await selectSunoEngine(page);
    await enableGuidedShowAll(page);

    const panel = saveLoadPanel(page);
    await panel.locator('input[type="file"][accept="application/json"]').setInputFiles(BUNDLE_FIXTURE);
    await expectToast(page, /Imported project bundle/i);

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

    const maestro = page.getByTestId("maestro-chat-panel");
    await maestro.scrollIntoViewIfNeeded();

    const input = maestroChatInput(maestro);
    await input.fill("show vocal embed plan");
    await maestro.getByRole("button", { name: /^Send$/i }).click();

    await expect(maestro.getByText(/Vocal embed is staged/i)).toBeVisible({ timeout: 20_000 });
  });
});
