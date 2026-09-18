/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isTauriApp } from "../app/lib/dsp-bridge";
import { resetSidecarHealthCache, resolveSidecarAuthToken } from "../app/lib/sidecar-bridge.ts";

vi.mock("../app/lib/dsp-bridge", () => ({ isTauriApp: vi.fn() }));

describe("resolveSidecarAuthToken", () => {
  const invoke = vi.fn();

  beforeEach(() => {
    resetSidecarHealthCache();
    vi.mocked(isTauriApp).mockReturnValue(true);
    invoke.mockReset();
    Object.defineProperty(window, "__TAURI__", {
      configurable: true,
      value: { core: { invoke } },
    });
    delete process.env.NEXT_PUBLIC_SIDECAR_TOKEN;
  });

  afterEach(() => {
    resetSidecarHealthCache();
    delete window.__TAURI__;
    delete process.env.NEXT_PUBLIC_SIDECAR_TOKEN;
    vi.clearAllMocks();
  });

  it("retries after a failed Tauri invoke instead of caching null", async () => {
    invoke.mockRejectedValueOnce(new Error("not ready"));
    await expect(resolveSidecarAuthToken()).resolves.toBeNull();
    invoke.mockResolvedValueOnce("secret-token");
    await expect(resolveSidecarAuthToken()).resolves.toBe("secret-token");
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it("caches a successful token", async () => {
    invoke.mockResolvedValue("cached-token");
    await expect(resolveSidecarAuthToken()).resolves.toBe("cached-token");
    await expect(resolveSidecarAuthToken()).resolves.toBe("cached-token");
    expect(invoke).toHaveBeenCalledTimes(1);
  });
});
