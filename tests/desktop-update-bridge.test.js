/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isTauriApp } from "../app/lib/dsp-bridge";
import {
  checkForDesktopUpdates,
  getDesktopUpdateRuntime,
  installDesktopUpdate,
  subscribeToDesktopUpdateStatus,
} from "../app/lib/desktop-update-bridge";

vi.mock("../app/lib/dsp-bridge", () => ({ isTauriApp: vi.fn() }));

describe("desktop-update-bridge", () => {
  const invoke = vi.fn();

  beforeEach(() => {
    vi.mocked(isTauriApp).mockReturnValue(false);
    invoke.mockReset();
    Object.defineProperty(window, "__TAURI__", {
      configurable: true,
      value: { core: { invoke } },
    });
  });

  afterEach(() => {
    delete window.__TAURI__;
    vi.clearAllMocks();
  });

  it("prefers signed Tauri Studio updates", async () => {
    vi.mocked(isTauriApp).mockReturnValue(true);
    invoke.mockResolvedValue({ ok: true, available: true, version: "0.51.0" });

    expect(getDesktopUpdateRuntime()).toBe("tauri");
    await expect(checkForDesktopUpdates()).resolves.toMatchObject({ version: "0.51.0" });
    expect(invoke).toHaveBeenCalledWith("check_studio_update");

    await installDesktopUpdate();
    expect(invoke).toHaveBeenCalledWith("update_studio_all");
  });

  it("stays inert in the browser", async () => {
    expect(getDesktopUpdateRuntime()).toBeNull();
    await expect(checkForDesktopUpdates()).resolves.toMatchObject({ ok: false, available: false });
  });

  it("drops a late listen callback after unsubscribe", async () => {
    vi.mocked(isTauriApp).mockReturnValue(true);
    const unlisten = vi.fn();
    let resolveListen;
    const listen = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveListen = resolve;
        }),
    );
    Object.defineProperty(window, "__TAURI__", {
      configurable: true,
      value: { core: { invoke }, event: { listen } },
    });
    const stop = subscribeToDesktopUpdateStatus(() => {});
    stop();
    resolveListen(unlisten);
    await Promise.resolve();
    expect(unlisten).toHaveBeenCalledTimes(1);
  });
});
