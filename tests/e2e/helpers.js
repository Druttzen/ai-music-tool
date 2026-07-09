import { expect } from "@playwright/test";

export async function clearProjectStorage(page) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("__e2e_storage_cleared__")) return;
    localStorage.clear();
    localStorage.setItem("ai_music_creator_guided_show_all", "1");
    sessionStorage.setItem("__e2e_storage_cleared__", "1");
  });
}

/** Reveal all workspace panels (e2e + power users) when Suno guided focus is active. */
export async function enableGuidedShowAll(page) {
  await page.evaluate(() => {
    localStorage.setItem("ai_music_creator_guided_show_all", "1");
  });
}

/** Guided step coach only appears when Suno focus mode is active (show-all off). */
export async function enableGuidedStepCoach(page) {
  await page.addInitScript(() => {
    try {
      localStorage.removeItem("ai_music_creator_guided_show_all");
    } catch {
      /* ignore */
    }
  });
  await page.evaluate(() => {
    localStorage.removeItem("ai_music_creator_guided_show_all");
  });
}

export async function dismissSplash(page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("ai_music_creator_guided_show_all", "1");
    } catch {
      /* ignore */
    }
  });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await skipSplashIfVisible(page);
}

export async function skipSplashIfVisible(page) {
  const skip = page.getByRole("button", { name: "Skip intro" });
  if (await skip.isVisible().catch(() => false)) {
    await skip.click({ force: true, timeout: 5000 }).catch(async () => {
      await page.keyboard.press("Escape").catch(() => {});
    });
    return;
  }
  await page.keyboard.press("Escape").catch(() => {});
  await page.locator("body").click({ position: { x: 8, y: 8 }, force: true }).catch(() => {});
}

export async function selectSunoEngine(page) {
  const coPanel = coProducerPanel(page);
  await coPanel.locator("label").filter({ hasText: "Prompt Engine" }).locator("select").selectOption("Suno-like");
}

export function analyzerPanel(page) {
  return page
    .locator("section.rounded-3xl")
    .filter({ has: page.getByRole("heading", { name: "Drag & Drop Analyzers" }) });
}

/** Upload audio fixture and wait for track report UI (sidecar analyze can be slow on CI). */
export async function uploadAnalyzerAudioFixture(panel, fixturePath, fileName, timeout = 60_000) {
  await panel.locator('input[type="file"][accept*="audio/wav"]').setInputFiles(fixturePath);
  await expect(panel.getByText(fileName, { exact: true })).toBeVisible({ timeout });
  await expect(panel.getByRole("button", { name: "Merge into Suno fields →" })).toBeVisible({
    timeout: 10_000,
  });
}

/** Patch highlight range on loaded analyzer state (dev e2e hook). */
export async function patchAudioAnalysisHighlight(page, { highlightStart, highlightEnd }) {
  await page.evaluate(
    ({ highlightStart, highlightEnd }) => {
      window.dispatchEvent(
        new CustomEvent("aimc-e2e-patch-audio-analysis", {
          detail: { highlightStart, highlightEnd },
        }),
      );
    },
    { highlightStart, highlightEnd },
  );
}

export function coProducerPanel(page) {
  return page.locator("section").filter({ hasText: "Co‑Producer AI" });
}

export function maestroChatPanel(page) {
  return page.getByTestId("maestro-chat-panel");
}

/** Maestro draft field (single-line input). */
export function maestroChatInput(page) {
  return maestroChatPanel(page).locator("input").first();
}

export function saveLoadPanel(page) {
  return page.locator("section").filter({ hasText: "Save / Load" });
}

export function ideaInput(page) {
  return page
    .locator("section.rounded-3xl")
    .filter({ has: page.getByRole("heading", { name: "Step 1 — Idea Input" }) })
    .locator("input")
    .first();
}

export function voiceCharacterStudioPanel(page) {
  return page.locator("section.rounded-3xl").filter({
    has: page.getByRole("heading", { name: "Voice Character Studio" }),
  });
}

export function vocalEmbedStudioPanel(page) {
  return page.getByTestId("vocal-embed-studio");
}

export function musicControlsPanel(page) {
  return page.locator("section").filter({ hasText: "Step 3 — Clickable Music Controls" });
}

export function lyricStylePanel(page) {
  return page.locator("section.rounded-3xl").filter({
    has: page.getByRole("heading", { name: "Lyric Style Generator" }),
  });
}

export function guidedSunoPanel(page) {
  return page.locator("section.rounded-3xl").filter({
    has: page.getByRole("navigation", { name: "Suno guided steps" }),
  });
}

export function promptPreviewPanel(page) {
  return page.locator("section").filter({ hasText: "Prompt Preview" });
}

export function sunoReimportPanel(page) {
  return page.getByTestId("suno-reimport-panel");
}

export function styleDnaSearchPanel(page) {
  return page.getByTestId("style-dna-search-panel");
}

export async function selectStandardEngine(page) {
  const coPanel = coProducerPanel(page);
  await coPanel.locator("label").filter({ hasText: "Prompt Engine" }).locator("select").selectOption("Standard");
}

export async function expectToast(page, textPattern, timeout = 15_000) {
  const toast = page.getByTestId("action-toast");
  await expect(toast).toBeVisible({ timeout });
  await expect(toast).toContainText(textPattern, { timeout });
  await expect(toast).toHaveAttribute("data-toast-type", /.+/);
}

/** Wait until debounced autosave persists `marker` into project localStorage. */
export async function waitForAutosavedMarker(page, marker, timeout = 8000) {
  await expect
    .poll(async () => {
      const stored = await page.evaluate(() =>
        localStorage.getItem("ai_music_creator_visual_tool_v3"),
      );
      return stored?.includes(marker) ?? false;
    }, { timeout })
    .toBe(true);
}

/** Assert Style + Lyrics copy after analyzer merge (clipboard permissions required). */
export async function expectSunoFieldCopies(page, context, { stylePattern }) {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);

  const toast = page.getByTestId("action-toast");
  const preview = promptPreviewPanel(page);
  await preview.getByRole("button", { name: "Copy Style box" }).click();
  await expect(toast).toContainText(/Suno Style box copied/i);
  const styleClipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(styleClipboard.length).toBeGreaterThan(20);
  expect(styleClipboard).toMatch(stylePattern);

  await lyricStylePanel(page).getByRole("button", { name: "Copy Lyrics field" }).click();
  await expect(toast).toContainText(/Suno Lyrics field copied/i);
  const lyricsClipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(lyricsClipboard.length).toBeGreaterThan(0);
}
