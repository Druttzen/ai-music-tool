import { expect, test } from "@playwright/test";
import { analyzerPanel, dismissSplash, uploadAnalyzerAudioFixture } from "./helpers";

test("mastering finishes with a real WAV download and retained status on desktop and mobile", async ({ page }) => {
  test.setTimeout(120_000);
  // This test exercises real browser audio processing; AI availability is independent.
  await page.route("http://127.0.0.1:8723/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/health") return route.fulfill({ json: { owned: true, vision_available: false } });
    if (path === "/analyze") return route.fulfill({ json: { duration_sec: 4, tempo_bpm: 120, key_estimate: "C major", spectral_centroid_hz: 1800, device: "cpu" } });
    return route.fulfill({ status: 503, json: { detail: "Optional AI unavailable in browser test" } });
  });
  await dismissSplash(page);
  const panel = analyzerPanel(page);
  await uploadAnalyzerAudioFixture(panel, "tests/fixtures/e2e-analyzer-tone.wav", "e2e-analyzer-tone.wav");
  await panel.getByRole("button", { name: "WAV 16-bit", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await panel.getByRole("button", { name: /Streaming.*LUFS/i }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/enhanced-streaming\.wav$/);
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const bytes = Buffer.concat(chunks);
  expect(bytes.subarray(0, 4).toString()).toBe("RIFF");
  expect(bytes.length).toBeGreaterThan(1000);
  const bar = page.getByTestId("process-status-bar");
  await expect(bar).toBeVisible();
  await bar.getByRole("button", { name: /Activity/ }).click();
  const mastering = bar.locator('[data-process-state="done"]').filter({ hasText: "Mastering ·" });
  await expect(mastering).toContainText("Completed · 100%");
  await page.screenshot({ path: "build/diagnostics/status-bar-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(mastering).toBeVisible();
  const bounds = await bar.boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  const toast = page.getByTestId("action-toast");
  if (await toast.isVisible()) {
    const toastBounds = await toast.boundingBox();
    expect(toastBounds.y + toastBounds.height).toBeLessThan(bounds.y);
    expect(toastBounds.x).toBeGreaterThanOrEqual(0);
    expect(toastBounds.x + toastBounds.width).toBeLessThanOrEqual(390);
  }
  await page.screenshot({ path: "build/diagnostics/status-bar-mobile.png" });
});
