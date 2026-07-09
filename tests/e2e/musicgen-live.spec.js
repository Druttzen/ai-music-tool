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

  test("generate and merge MusicGen preview into Suno Style", async ({ page, context }) => {
    test.setTimeout(180_000);

    await dismissSplash(page);
    await selectSunoEngine(page);

    const panel = analyzerPanel(page);
    await panel.scrollIntoViewIfNeeded();

    await expect(panel.getByText("MusicGen: ready")).toBeVisible({ timeout: 30_000 });

    const durationSelect = panel.locator("label").filter({ hasText: "Duration" }).locator("select");
    await durationSelect.selectOption("5");

    await panel.getByRole("button", { name: "Generate & play" }).click();

    const toast = page.getByTestId("action-toast");
    await expect(toast).toBeVisible({ timeout: 15_000 });
    await expect(toast).toContainText(/MusicGen preview merged/i, { timeout: 180_000 });

    await expect(panel.getByText(/musicgen-preview-/i)).toBeVisible({ timeout: 10_000 });

    await expectSunoFieldCopies(page, context, { stylePattern: /MG:/ });
  });
});
