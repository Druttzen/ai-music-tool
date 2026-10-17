import { expect, test } from "@playwright/test";
import { dismissSplash } from "./helpers";

test("Studio update button bypasses Python updates and retains feed failures", async ({ page }) => {
  await page.addInitScript(() => {
    window.updateAudit = { commands: [], fail: false };
    window.__TAURI__ = {
      core: { invoke: async (command) => {
        window.updateAudit.commands.push(command);
        if (command === "check_studio_update" || command === "install_studio_update") {
          if (command === "install_studio_update" && window.updateAudit.fail) return { ok: false, available: false, currentVersion: "0.50.74", error: "Studio update feed HTTP 403" };
          return { ok: true, available: false, currentVersion: "0.50.74", version: "0.50.70" };
        }
        if (command === "list_installed_sidecar_extras") return [];
        if (command === "probe_sidecar_extra_install_env") return { mode: "managed", writable: false };
        if (command === "suite_canvas_addon_status") return { installed: false };
        if (command === "sidecar_status") return { ready: false, spawned: false, port: 8723 };
        return null;
      } },
      event: { listen: async () => () => {} },
    };
  });
  await page.route("http://127.0.0.1:8723/**", route => route.fulfill({ json: { owned: true, capabilities: [] } }));
  await dismissSplash(page);
  const controls = page.getByText("Desktop updates", { exact: true }).locator("..");
  await controls.getByRole("button", { name: "Check for updates", exact: true }).click();
  await expect(controls).toContainText("Installed 0.50.74 · Latest published 0.50.70");
  await controls.getByRole("button", { name: "Update Studio app", exact: true }).click();
  await expect(controls).toContainText("No newer published Studio version");
  expect(await page.evaluate(() => window.updateAudit.commands)).toContain("install_studio_update");
  expect(await page.evaluate(() => window.updateAudit.commands)).not.toContain("update_studio_all");
  await page.evaluate(() => { window.updateAudit.fail = true; });
  await controls.getByRole("button", { name: "Update Studio app", exact: true }).click();
  await expect(controls).toContainText("Studio update feed HTTP 403");
  await page.waitForTimeout(3200);
  await expect(controls).toContainText("Studio update feed HTTP 403");
  await expect(page.getByTestId("process-status-bar")).toContainText("failed");
  await page.screenshot({ path: "build/diagnostics/updater-audit-2026-10-17/updater-controls.png" });
});
