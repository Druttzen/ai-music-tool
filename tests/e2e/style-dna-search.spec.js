import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {
  clearProjectStorage,
  dismissSplash,
  expectToast,
  ideaInput,
  styleDnaSearchPanel,
} from "./helpers.js";

const MB_FIXTURE = JSON.parse(
  fs.readFileSync(path.join("tests", "fixtures", "e2e-musicbrainz-style-dna.json"), "utf8"),
);

test.describe("Style-DNA search panel e2e", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/musicbrainz.org/ws/2/recording**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MB_FIXTURE),
      });
    });
    await clearProjectStorage(page);
  });

  test("search via MusicBrainz fallback shows results and style token preview", async ({ page }) => {
    await dismissSplash(page);

    const panel = styleDnaSearchPanel(page);
    await panel.scrollIntoViewIfNeeded();

    await panel.getByTestId("style-dna-search-input").fill("E2E Techno Pulse");
    await panel.getByTestId("style-dna-search-button").click();

    await expectToast(page, /Style DNA: 1 hit\(s\) via musicbrainz/i);

    const results = panel.getByTestId("style-dna-results");
    await expect(results).toBeVisible();
    await expect(results.getByText("E2E Artist — E2E Techno Pulse")).toBeVisible();

    const preview = panel.getByTestId("style-dna-token-preview");
    await expect(preview).toBeVisible();
    await expect(preview).not.toHaveText("");
  });

  test("apply Style DNA merges reference into project Goal", async ({ page }) => {
    await dismissSplash(page);

    const panel = styleDnaSearchPanel(page);
    await panel.scrollIntoViewIfNeeded();

    await panel.getByTestId("style-dna-search-input").fill("E2E Techno Pulse");
    await panel.getByTestId("style-dna-search-button").click();
    await expect(panel.getByTestId("style-dna-results")).toBeVisible();

    await panel.getByTestId("style-dna-apply-button").click();
    await expectToast(page, /Applied Style DNA: E2E Artist — E2E Techno Pulse/i);

    await expect(ideaInput(page)).toHaveValue(/Reference track: E2E Artist — E2E Techno Pulse/i);
  });
});
