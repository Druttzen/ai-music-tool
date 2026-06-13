import { test, expect } from "@playwright/test";
import { dismissSplash, lyricStylePanel, musicControlsPanel } from "./helpers.js";

test("Reset to Default clears preselected prompts to blank slate", async ({ page }) => {
  await dismissSplash(page);

  const ideaInput = page
    .locator("section")
    .filter({ hasText: "Step 1 — Idea Input" })
    .locator("input")
    .first();

  await ideaInput.fill("My custom idea before reset");

  const controlsPanel = musicControlsPanel(page);
  const housePill = controlsPanel.getByRole("button", { name: "House", exact: true });
  await housePill.click();
  await expect(housePill).toHaveClass(/border-cyan-300/);

  const lyricPanel = lyricStylePanel(page);
  await lyricPanel
    .locator("label")
    .filter({ hasText: "Lyric Theme" })
    .locator("input")
    .fill("My theme before reset");
  await controlsPanel.getByRole("button", { name: "Male Lead", exact: true }).click();
  await expect(lyricPanel.getByTestId("lyric-field-preview")).toContainText("My theme before reset");

  await page.getByRole("button", { name: "Reset to Default" }).click();

  await expect(ideaInput).toHaveValue("");
  await expect(housePill).not.toHaveClass(/border-cyan-300/);
  await expect(page.locator("header").getByText(/blank slate on guided step 1/i)).toBeVisible();
  await expect(lyricPanel.getByTestId("lyric-field-preview")).toContainText(/Instrumental only\./i);
  await expect(
    lyricPanel.locator("label").filter({ hasText: "Lyric Theme" }).locator("input"),
  ).toHaveValue("");
  await expect(controlsPanel.getByRole("button", { name: "Male Lead", exact: true })).not.toHaveClass(
    /border-cyan-300/,
  );
  await expect(lyricPanel.getByRole("button", { name: "Copy Generated Lyrics" })).toHaveCount(0);
});
