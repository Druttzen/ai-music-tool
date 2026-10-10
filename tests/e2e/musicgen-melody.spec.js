import { test, expect, request } from "@playwright/test";
import {
  analyzerPanel,
  dismissSplash,
  selectSunoEngine,
  uploadAnalyzerAudioFixture,
} from "./helpers.js";

const ANALYZER_FIXTURE = "tests/fixtures/e2e-instrumental-bed.wav";

test.describe("MusicGen melody e2e", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    test.skip(
      !!process.env.CI && process.env.AIMC_MUSICGEN_MELODY_E2E !== "1",
      "Melody MusicGen OOMs on default CI runners — set AIMC_MUSICGEN_MELODY_E2E=1 to force",
    );
    const ctx = await request.newContext({ timeout: 5_000 });
    let generateAvailable = false;
    let melodyCached = false;
    try {
      const res = await ctx.get("http://127.0.0.1:8723/health");
      if (res.ok()) {
        const body = await res.json();
        generateAvailable = !!body.generate_available;
        melodyCached = body.capabilities?.find((item) => item.id === "generate")?.models?.["facebook/musicgen-melody"] === true;
      }
    } catch {
      generateAvailable = false;
    }
    if (generateAvailable) {
      try {
        const access = await ctx.get("http://127.0.0.1:8723/jobs/e2e-access-probe");
        generateAvailable = access.status() === 404;
      } catch { generateAvailable = false; }
    }
    await ctx.dispose();
    test.skip(
      !generateAvailable || !melodyCached,
      "Live test requires prepared models and an accessible standalone sidecar (the installed app uses its own token)",
    );
  });

  test("melody-conditioned generate merges MG line into Style", async ({ page }) => {
    // Melody conditioning is slower than text-only on CPU CI runners.
    test.setTimeout(420_000);

    await dismissSplash(page);
    await selectSunoEngine(page);

    const panel = analyzerPanel(page);
    await panel.scrollIntoViewIfNeeded();

    await expect(panel.getByText("MusicGen: ready")).toBeVisible({ timeout: 30_000 });

    await uploadAnalyzerAudioFixture(panel, ANALYZER_FIXTURE, "e2e-instrumental-bed.wav");

    await panel.getByLabel("Model", { exact: true }).selectOption("small");
    const melodyCheckbox = panel.getByLabel("Condition on current track audio (melody mode)");
    await expect(melodyCheckbox).toBeVisible({ timeout: 10_000 });
    await melodyCheckbox.check();

    await panel.locator("label").filter({ hasText: "Duration" }).locator("select").selectOption("5");
    await panel.getByRole("button", { name: "Generate & play" }).click();

    const toast = page.getByTestId("action-toast");
    await expect(toast).toContainText(/MusicGen preview merged.*melody/i, { timeout: 360_000 });

    const validator = page.locator("section").filter({ hasText: "Suno-like Validator" });
    await expect(validator).toContainText(/MG:/);
  });
});
