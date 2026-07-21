/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isTauriApp } from "../app/lib/dsp-bridge";
import {
  checkForAppUpdates,
  isElectronApp,
  quitAndInstallUpdate,
} from "../app/lib/electron-bridge";
import {
  checkForDesktopUpdates,
  getDesktopUpdateRuntime,
  installDesktopUpdate,
} from "../app/lib/desktop-update-bridge";

vi.mock("../app/lib/dsp-bridge", () => ({ isTauriApp: vi.fn() }));
vi.mock("../app/lib/electron-bridge", () => ({
  checkForAppUpdates: vi.fn(),
  isElectronApp: vi.fn(),
  quitAndInstallUpdate: vi.fn(),
  subscribeToUpdateStatus: vi.fn(() => () => {}),
}));

describe("desktop-update-bridge", () => {
  const invoke = vi.fn();

  beforeEach(() => {
    vi.mocked(isTauriApp).mockReturnValue(false);
    vi.mocked(isElectronApp).mockReturnValue(false);
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
    expect(invoke).toHaveBeenCalledWith("install_studio_update");
  });

  it("keeps the legacy Electron updater available", async () => {
    vi.mocked(isElectronApp).mockReturnValue(true);
    vi.mocked(checkForAppUpdates).mockResolvedValue({ ok: true, available: false });

    expect(getDesktopUpdateRuntime()).toBe("electron");
    await expect(checkForDesktopUpdates()).resolves.toMatchObject({ available: false });
    await installDesktopUpdate();
    expect(quitAndInstallUpdate).toHaveBeenCalledOnce();
  });

  it("stays inert in the browser", async () => {
    expect(getDesktopUpdateRuntime()).toBeNull();
    await expect(checkForDesktopUpdates()).resolves.toMatchObject({ ok: false, available: false });
  });
});
