import { test, expect, request } from "@playwright/test";
import {
  analyzerPanel,
  dismissSplash,
  expectSunoFieldCopies,
  selectSunoEngine,
} from "./helpers.js";

test.describe("MusicGen live e2e", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    const ctx = await request.newContext({ timeout: 5_000 });
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
    if (generateAvailable) {
      try {
        const access = await ctx.get("http://127.0.0.1:8723/jobs/e2e-access-probe");
        generateAvailable = access.status() === 404;
      } catch { generateAvailable = false; }
    }
    await ctx.dispose();
    test.skip(
      !generateAvailable,
      "Live test requires prepared models and an accessible standalone sidecar (the installed app uses its own token)",
    );
  });

  test("generate and merge MusicGen preview into Suno Style", async ({ page, context }) => {
    test.setTimeout(240_000);

    await dismissSplash(page);
    await selectSunoEngine(page);

    const panel = analyzerPanel(page);
    await panel.scrollIntoViewIfNeeded();

    await expect(panel.getByText("MusicGen: ready")).toBeVisible({ timeout: 30_000 });

    const durationSelect = panel.locator("label").filter({ hasText: "Duration" }).locator("select");
    await durationSelect.selectOption("5");

    await panel.getByRole("button", { name: "Generate & play" }).click();

    const toast = page.getByTestId("action-toast");
    await expect(toast).toContainText(/MusicGen preview merged/i, { timeout: 180_000 });

    await expect(panel.getByTestId("analyzer-track-filename")).toContainText(/musicgen-preview-/i, {
      timeout: 10_000,
    });

    await expectSunoFieldCopies(page, context, { stylePattern: /MG:/ });
  });
});
