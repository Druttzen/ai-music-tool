import { test, expect } from "@playwright/test";
import { dismissSplash, expectToast } from "./helpers.js";

test.describe("Button feedback toasts", () => {
  test("Save Progress shows animated confirmation", async ({ page }) => {
    await dismissSplash(page);
    await page.getByRole("button", { name: "Save Progress" }).click();
    await expectToast(page, /Saved/i);
    await expect(page.getByText(/Saved at /i)).toBeVisible();
  });

  test("Export Bundle shows confirmation", async ({ page }) => {
    await dismissSplash(page);
    await page.getByRole("button", { name: "Export Bundle" }).click();
    await expectToast(page, /Exported project bundle/i);
  });

  test("Pro Mode toggle shows confirmation", async ({ page }) => {
    await dismissSplash(page);
    await page.getByRole("button", { name: "Pro Mode OFF" }).click();
    await expectToast(page, /Pro Mode enabled/i);
    await page.getByRole("button", { name: "Pro Mode ON" }).click();
    await expectToast(page, /Pro Mode disabled/i);
  });

  test("Mode pill shows confirmation", async ({ page }) => {
    await dismissSplash(page);
    const modePanel = page.locator("section").filter({ hasText: "Controls stability vs creativity" });
    await modePanel.getByRole("button", { name: "Hybrid", exact: true }).click();
    await expectToast(page, /Mode: Hybrid/i);
  });

  test("Co-Producer Improve Prompt shows confirmation", async ({ page }) => {
    await dismissSplash(page);
    await page.getByRole("button", { name: "Improve Prompt" }).click();
    await expectToast(page, /Co-Producer AI updated prompt/i);
  });

  test("Quick rule fix chip shows confirmation", async ({ page }) => {
    await dismissSplash(page);
    const coPanel = page.locator("section").filter({ hasText: "Co‑Producer AI" });
    await coPanel.getByRole("button", { name: "Weak bass", exact: true }).click();
    await expectToast(page, /Applied fix: Weak bass/i);
  });

  test("Co-Producer direction button shows confirmation", async ({ page }) => {
    await dismissSplash(page);
    await page.getByRole("button", { name: "Make darker", exact: true }).click();
    await expectToast(page, /Make darker/i);
  });

  test("Copy Prompt shows confirmation", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await dismissSplash(page);
    await page.getByRole("button", { name: "Copy Prompt" }).click();
    await expectToast(page, /Prompt copied/i);
  });

  test("Generate variations shows confirmation", async ({ page }) => {
    await dismissSplash(page);
    await page.getByRole("button", { name: /^Generate \d+ Variations$/ }).click();
    await expectToast(page, /Generated \d+ variations/i);
  });

  test("Suno guided Next step shows confirmation", async ({ page }) => {
    await dismissSplash(page);
    const coPanel = page.locator("section").filter({ hasText: "Co‑Producer AI" });
    await coPanel.locator("label").filter({ hasText: "Prompt Engine" }).locator("select").selectOption("Suno-like");
    await page.getByRole("button", { name: "Next step" }).click();
    await expectToast(page, /Suno step 2:/i);
  });

  test("Factory preset load shows confirmation", async ({ page }) => {
    await dismissSplash(page);
    const presetsPanel = page.locator("section").filter({ hasText: "Style Presets" });
    await presetsPanel.getByRole("button", { name: "Techno Core", exact: true }).click();
    await expectToast(page, /Loaded preset: Techno Core/i);
  });

  test("Toast dismiss button clears notification", async ({ page }) => {
    await dismissSplash(page);
    await page.getByRole("button", { name: "Save Progress" }).click();
    const toast = page.getByTestId("action-toast");
    await expect(toast).toBeVisible();
    await toast.getByRole("button", { name: "Dismiss notification" }).click();
    await expect(toast).toHaveCount(0);
  });
});
