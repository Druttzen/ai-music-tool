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
  installStudioAppUpdate,
  subscribeToDesktopUpdateStatus,
} from "../app/lib/desktop-update-bridge.js";

vi.mock("../app/lib/desktop-update-bridge.js", () => ({
  getDesktopUpdateRuntime: vi.fn(() => "tauri"),
  checkForDesktopUpdates: vi.fn(async () => ({ ok: true, available: false })),
  installDesktopUpdate: vi.fn(async () => ({ ok: true, available: false, summary: "current" })),
  installStudioAppUpdate: vi.fn(async () => ({ ok: true, available: false })),
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
    installStudioAppUpdate.mockResolvedValue({ ok: true, available: false });
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
    expect(installStudioAppUpdate).not.toHaveBeenCalled();
    expect(result.current.visible).toBe(false);
    expect(result.current.busy).toBe(false);
  });

  it("treats the 85% Studio check as a stall", () => {
    expect(isStuckStudioUpdateProgress("Checking Studio app update…", 85)).toBe(true);
    expect(isStuckStudioUpdateProgress("Downloading Studio update…", 90)).toBe(false);
  });

  it("automatic startup updates install only Studio once across both hook instances", async () => {
    checkForDesktopUpdates.mockResolvedValue({ ok: true, available: true, version: "0.51.0" });
    renderHook(() => useDesktopUpdates());
    renderHook(() => useDesktopUpdates());
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1700); });
    expect(installStudioAppUpdate).toHaveBeenCalledTimes(1);
    expect(installDesktopUpdate).not.toHaveBeenCalled();
  });

  it("Update all refreshes components through its own command", async () => {
    const { result } = renderHook(() => useDesktopUpdates());
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    await act(async () => { await result.current.updateAll(); });
    expect(installDesktopUpdate).toHaveBeenCalledTimes(1);
    expect(installStudioAppUpdate).not.toHaveBeenCalled();
  });

  it("updates Studio directly without refreshing Python or plugins", async () => {
    const { result } = renderHook(() => useDesktopUpdates());
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    installStudioAppUpdate.mockResolvedValue({ ok: true, available: false, currentVersion: "0.50.70", version: "0.50.70" });
    await act(async () => { await result.current.updateApp(); });
    expect(installStudioAppUpdate).toHaveBeenCalledOnce();
    expect(installDesktopUpdate).not.toHaveBeenCalled();
    expect(result.current.status).toMatch(/No newer published Studio version/);
    expect(result.current.status).toContain("0.50.70");
    expect(result.current.currentVersion).toBe("0.50.70");
    expect(result.current.publishedVersion).toBe("0.50.70");
  });

  it("keeps an app update failure visible instead of hiding it after a few seconds", async () => {
    const { result } = renderHook(() => useDesktopUpdates());
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    installStudioAppUpdate.mockResolvedValue({ ok: false, error: "Studio update feed HTTP 403" });
    await act(async () => { await result.current.updateApp(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(result.current.status).toContain("HTTP 403");
    expect(result.current.busy).toBe(false);
    expect(result.current.progressPct).toBe(null);
  });

  it("shows published and installed versions even when there is no newer release", async () => {
    checkForDesktopUpdates.mockResolvedValue({ ok: true, available: false, currentVersion: "0.50.73", version: "0.50.70" });
    const { result } = renderHook(() => useDesktopUpdates());
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    await act(async () => { await result.current.checkUpdates(); });
    expect(result.current.status).toContain("published 0.50.70");
    expect(result.current.status).toContain("installed 0.50.73");
    expect(installDesktopUpdate).not.toHaveBeenCalled();
  });

  it("does not mark a fully downloaded installer as an installed app", async () => {
    let onProgress = () => {};
    subscribeToDesktopUpdateStatus.mockImplementation(cb => { onProgress = cb; return () => {}; });
    const { result } = renderHook(() => useDesktopUpdates());
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    await act(async () => { onProgress({ phase: "studio-download", message: "Downloading signed Studio update…", pct: 100 }); });
    expect(result.current.busy).toBe(true);
    await act(async () => { onProgress({ phase: "studio-install", message: "Installing verified Studio update. Restarting…" }); });
    expect(result.current.busy).toBe(true);
    expect(result.current.progressPct).toBe(null);
  });

  it("preserves component error details and never claims 100% on failure", async () => {
    const { result } = renderHook(() => useDesktopUpdates());
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    installDesktopUpdate.mockResolvedValue({ ok: false, error: "vocal-rvc: Python.h missing", summary: "1 component needs attention" });
    await act(async () => { await result.current.updateAll(); });
    expect(result.current.status).toBe("vocal-rvc: Python.h missing");
    expect(result.current.progressPct).toBe(null);
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

  it("hides the status bar after a finished progress event even without updateAll", async () => {
    /** @type {(payload: object) => void} */
    let onProgress = () => {};
    subscribeToDesktopUpdateStatus.mockImplementation((cb) => {
      onProgress = cb;
      return () => {};
    });

    const { result } = renderHook(() => useDesktopUpdates());
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    await act(async () => {
      onProgress({
        phase: "plugin",
        message: "Updating stems…",
        pct: 65,
      });
    });
    expect(result.current.visible).toBe(true);
    expect(result.current.busy).toBe(true);

    await act(async () => {
      onProgress({
        phase: "studio",
        message: "Studio app update check finished",
        pct: 100,
      });
    });
    expect(result.current.busy).toBe(false);
    expect(result.current.visible).toBe(true);
    expect(result.current.status).toMatch(/finished/i);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2200);
    });
    expect(result.current.visible).toBe(false);
    expect(result.current.status).toBe("");
    expect(result.current.progressPct).toBe(null);
  });
});
