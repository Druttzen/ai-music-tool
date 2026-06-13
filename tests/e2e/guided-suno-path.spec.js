import { test, expect } from "@playwright/test";
import { dismissSplash, guidedSunoPanel, selectSunoEngine } from "./helpers.js";

test.describe("Guided Suno path e2e", () => {
  test("factory preset, step navigation, final style under 1000 chars", async ({
    page,
    context,
  }) => {
    await dismissSplash(page);
    await selectSunoEngine(page);

    const guided = guidedSunoPanel(page);
    await guided.scrollIntoViewIfNeeded();

    await expect(
      guided.getByRole("heading", { name: /Suno path — Style preset \(1 \/ 8\)/ }),
    ).toBeVisible();

    await guided.getByRole("button", { name: "Techno Core" }).click();
    await expect(page.getByTestId("action-toast")).toContainText(/Loaded preset: Techno Core/i);

    const preview = guided.locator(".font-mono.text-cyan-50\\/90").first();
    await expect(preview).not.toHaveText("—");
    await expect(preview).toContainText(/Techno|130/i);

    await guided.getByRole("button", { name: "Next step" }).click();
    await expect(
      guided.getByRole("heading", { name: /Suno path — Mood & mode \(2 \/ 8\)/ }),
    ).toBeVisible();

    await guided.getByRole("button", { name: "Next step" }).click();
    await expect(
      guided.getByRole("heading", { name: /Suno path — Groove & sound \(3 \/ 8\)/ }),
    ).toBeVisible();

    await guided.getByRole("button", { name: "Skip to final copy" }).click();
    await expect(
      guided.getByRole("heading", { name: /Suno path — Copy to Suno \(8 \/ 8\)/ }),
    ).toBeVisible();

    const charLine = guided.getByText(/\d+ \/ 1000 chars/);
    await expect(charLine).toBeVisible();
    const charText = await charLine.textContent();
    const styleLen = Number(charText.match(/(\d+) \/ 1000/)?.[1]);
    expect(styleLen).toBeGreaterThan(20);
    expect(styleLen).toBeLessThanOrEqual(1000);

    const validator = page.locator("section").filter({ hasText: "Suno-like Validator" });
    await expect(validator).toContainText(/Style:\s*[1-9]\d*\s*\/\s*1000/);

    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await guided.getByRole("button", { name: "Copy final Style (Suno box)" }).click();
    await expect(page.getByTestId("action-toast")).toContainText(/Suno style/i);

    const styleClipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(styleClipboard.length).toBe(styleLen);
    expect(styleClipboard.length).toBeLessThanOrEqual(1000);
    expect(styleClipboard).toMatch(/Techno|130/i);
  });
});
