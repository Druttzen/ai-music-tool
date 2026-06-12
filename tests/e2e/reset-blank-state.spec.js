import { test, expect } from "@playwright/test";

test("Reset to Default clears preselected prompts to blank slate", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  await page.keyboard.press("Escape").catch(() => {});
  await page.locator("body").click({ position: { x: 8, y: 8 }, force: true }).catch(() => {});

  const ideaInput = page
    .locator("section")
    .filter({ hasText: "Step 1 — Idea Input" })
    .locator("input")
    .first();

  await ideaInput.fill("My custom idea before reset");

  const controlsPanel = page.locator("section").filter({
    hasText: "Step 3 — Clickable Music Controls",
  });
  const housePill = controlsPanel.getByRole("button", { name: "House", exact: true });
  await housePill.click();
  await expect(housePill).toHaveClass(/border-cyan-300/);

  await page.getByRole("button", { name: "Reset to Default" }).click();

  await expect(ideaInput).toHaveValue("");
  await expect(housePill).not.toHaveClass(/border-cyan-300/);
  await expect(page.getByText(/blank slate on guided step 1/i)).toBeVisible();
});
