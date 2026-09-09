/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import { DesktopUpdateStatusBar } from "../app/components/desktop-update-status-bar.jsx";
import {
  resetDesktopUpdateSilentFlagForTests,
  useDesktopUpdates,
  isStuckStudioUpdateProgress,
} from "../app/hooks/use-desktop-updates.js";
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
    resetDesktopUpdateSilentFlagForTests();
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

  it("treats the 85% Studio check as a stall", () => {
    expect(isStuckStudioUpdateProgress("Checking Studio app update…", 85)).toBe(true);
    expect(isStuckStudioUpdateProgress("Downloading Studio update…", 90)).toBe(false);
  });

  it("exposes Update all / check controls for the header", async () => {
    const { result } = renderHook(() => useDesktopUpdates());
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    expect(result.current.installReady).toBe(true);
    expect(result.current.installLabel).toBe("Update all");
    expect(typeof result.current.checkUpdates).toBe("function");
    expect(typeof result.current.updateAll).toBe("function");
  });

  it("clears a stuck Studio app update check at 85%", async () => {
    /** @type {(payload: object) => void} */
    let onProgress = () => {};
    subscribeToDesktopUpdateStatus.mockImplementation((cb) => {
      onProgress = cb;
      return () => {};
    });
    installDesktopUpdate.mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() => useDesktopUpdates());
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    await act(async () => {
      onProgress({
        phase: "studio",
        message: "Checking Studio app update…",
        pct: 85,
      });
    });
    expect(result.current.progressPct).toBe(85);
    expect(result.current.visible).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(result.current.busy).toBe(false);
    expect(result.current.status).toMatch(/timed out/i);
  });
});
