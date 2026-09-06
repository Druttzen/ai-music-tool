/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import { DesktopUpdateStatusBar } from "../app/components/desktop-update-status-bar.jsx";
import { useDesktopUpdates } from "../app/hooks/use-desktop-updates.js";
import {
  checkForDesktopUpdates,
  getDesktopUpdateRuntime,
  installDesktopUpdate,
  subscribeToDesktopUpdateStatus,
} from "../app/lib/desktop-update-bridge.js";

vi.mock("../app/lib/desktop-update-bridge.js", () => ({
  getDesktopUpdateRuntime: vi.fn(() => "tauri"),
  checkForDesktopUpdates: vi.fn(async () => ({ ok: true, available: false })),
  installDesktopUpdate: vi.fn(async () => ({ ok: true, available: false, summary: "current" })),
  subscribeToDesktopUpdateStatus: vi.fn(() => () => {}),
}));

describe("useDesktopUpdates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    getDesktopUpdateRuntime.mockReturnValue("tauri");
    checkForDesktopUpdates.mockResolvedValue({ ok: true, available: false });
    installDesktopUpdate.mockResolvedValue({ ok: true, available: false, summary: "current" });
    subscribeToDesktopUpdateStatus.mockReturnValue(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("SSR omits the desktop update status bar even when a desktop runtime exists", () => {
    const html = renderToString(createElement(DesktopUpdateStatusBar));
    expect(html).not.toContain("Updating");
    expect(html).toBe("");
  });

  it("enables silent desktop updates after mount when a host is present", async () => {
    const { result } = renderHook(() => useDesktopUpdates());
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    expect(result.current.available).toBe(true);
  });

  it("stays hidden when no Studio update is available", async () => {
    const { result } = renderHook(() => useDesktopUpdates());
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    expect(result.current.available).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
    });
    await waitFor(() => {
      expect(checkForDesktopUpdates).toHaveBeenCalled();
    });
    expect(installDesktopUpdate).not.toHaveBeenCalled();
    expect(result.current.visible).toBe(false);
    expect(result.current.busy).toBe(false);
  });

  it("shows status while a silent update runs and hides when idle", async () => {
    checkForDesktopUpdates.mockResolvedValue({
      ok: true,
      available: true,
      version: "0.50.31",
    });
    let resolveInstall;
    installDesktopUpdate.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveInstall = resolve;
        }),
    );

    const { result } = renderHook(() => useDesktopUpdates());
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    expect(result.current.available).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
    });
    await waitFor(() => {
      expect(result.current.busy).toBe(true);
      expect(result.current.visible).toBe(true);
      expect(result.current.status).toContain("0.50.31");
    });

    await act(async () => {
      resolveInstall({ ok: true, available: true, summary: "installed" });
    });
    await waitFor(() => {
      expect(result.current.busy).toBe(false);
      expect(result.current.visible).toBe(false);
    });
  });
});
