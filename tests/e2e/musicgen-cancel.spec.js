import { test, expect } from "@playwright/test";
import { analyzerPanel, dismissSplash, selectSunoEngine } from "./helpers.js";

async function mockCancellableSidecarJob(page, { endpoint, jobId }) {
  let cancellationRequested = false;
  let cancelRequestCount = 0;

  await page.route("http://127.0.0.1:8723/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname === "/health" && request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          generate_available: true,
          acestep_available: true,
          owned: false,
        }),
      });
      return;
    }

    if (url.pathname === endpoint && request.method() === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ job_id: jobId }),
      });
      return;
    }

    if (url.pathname === `/jobs/${jobId}/cancel` && request.method() === "POST") {
      cancellationRequested = true;
      cancelRequestCount += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ job_id: jobId, status: "cancelled" }),
      });
      return;
    }

    if (url.pathname === `/jobs/${jobId}` && request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          job_id: jobId,
          status: cancellationRequested ? "cancelled" : "running",
          progress: 0.1,
          message: cancellationRequested ? "cancelled" : "generating",
        }),
      });
      return;
    }

    await route.continue();
  });

  return {
    cancelRequestCount: () => cancelRequestCount,
  };
}

test.describe("MusicGen cancellation e2e", () => {
  test("shows cancellation state and stops polling when cancel is requested", async ({ page }) => {
    const sidecar = await mockCancellableSidecarJob(page, {
      endpoint: "/generate/jobs",
      jobId: "e2e-musicgen-job",
    });

    await dismissSplash(page);
    await selectSunoEngine(page);

    const panel = analyzerPanel(page);
    await panel.scrollIntoViewIfNeeded();
    await expect(panel.getByText("MusicGen: ready")).toBeVisible({ timeout: 30_000 });

    await panel.getByRole("button", { name: "Generate & play" }).click();

    const cancelButton = panel.getByRole("button", { name: "Cancel generation" });
    await expect(cancelButton).toBeVisible({ timeout: 10_000 });
    await cancelButton.click();

    await expect(panel.getByRole("status")).toContainText(
      "Cancellation requested. Current inference may finish safely before it stops.",
    );
    await expect(page.getByTestId("action-toast")).toContainText("MusicGen generation cancelled", {
      timeout: 10_000,
    });
    await expect(cancelButton).toHaveCount(0);
    expect(sidecar.cancelRequestCount()).toBe(1);
  });

  test("cancels an ACE-Step full-song job through the same UI flow", async ({ page }) => {
    const sidecar = await mockCancellableSidecarJob(page, {
      endpoint: "/generate/song/jobs",
      jobId: "e2e-acestep-job",
    });

    await dismissSplash(page);
    await selectSunoEngine(page);

    const panel = analyzerPanel(page);
    await panel.scrollIntoViewIfNeeded();
    await panel.getByRole("button", { name: "Full song · MIT" }).click();

    const generateButton = panel.getByRole("button", { name: "Generate full song" });
    await expect(generateButton).toBeVisible({ timeout: 30_000 });
    await generateButton.click();

    const cancelButton = panel.getByRole("button", { name: "Cancel generation" });
    await expect(cancelButton).toBeVisible({ timeout: 10_000 });
    await cancelButton.click();

    await expect(panel.getByRole("status")).toContainText(
      "Cancellation requested. Current inference may finish safely before it stops.",
    );
    await expect(page.getByTestId("action-toast")).toContainText("ACE-Step generation cancelled", {
      timeout: 10_000,
    });
    await expect(cancelButton).toHaveCount(0);
    expect(sidecar.cancelRequestCount()).toBe(1);
  });
});
