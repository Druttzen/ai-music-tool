import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchSidecarHealth, resetSidecarHealthCache } = vi.hoisted(() => ({
  fetchSidecarHealth: vi.fn(),
  resetSidecarHealthCache: vi.fn(),
}));

vi.mock("../app/lib/sidecar-bridge.js", () => ({
  fetchSidecarHealth,
  resetSidecarHealthCache,
}));

import {
  SIDECAR_EXTRA_NPM,
  fetchSidecarHealthAfterExtraInstall,
  formatSidecarExtraInstallStatus,
  isSidecarExtraAllowlisted,
  normalizeSidecarExtraId,
  sidecarExtraHealthFlag,
  sidecarExtraInstallCompleted,
  sidecarExtraInstallStatusTone,
  sidecarExtraNpmHint,
  waitForSidecarExtraReady,
} from "../app/lib/sidecar-extra-install-client.js";
import { SCRIPT_STEM } from "../lib/sidecar-extra-install.cjs";

describe("sidecar extra install client", () => {
  beforeEach(() => {
    fetchSidecarHealth.mockReset();
    resetSidecarHealthCache.mockReset();
  });

  it("normalizes legacy capability ids", () => {
    expect(normalizeSidecarExtraId("vocal_ml")).toBe("vocal");
    expect(normalizeSidecarExtraId("rvc")).toBe("vocal-rvc");
    expect(normalizeSidecarExtraId("genre")).toBe("classify");
    expect(normalizeSidecarExtraId("cover-ref")).toBe("cover-ref");
  });

  it("maps npm hints and allowlist used by the UI", () => {
    expect(sidecarExtraNpmHint("generate")).toBe("npm run sidecar:generate");
    expect(sidecarExtraNpmHint("genre")).toBe("npm run sidecar:classify");
    expect(sidecarExtraNpmHint("vocal_ml")).toBe("npm run sidecar:vocal");
    expect(isSidecarExtraAllowlisted("cover")).toBe(true);
    expect(isSidecarExtraAllowlisted("vocal_ml")).toBe(true);
    expect(isSidecarExtraAllowlisted("vocal-ml")).toBe(false);
    expect(isSidecarExtraAllowlisted("nope")).toBe(false);
  });

  it("maps extras to /health flags", () => {
    expect(sidecarExtraHealthFlag("generate")).toBe("generate_available");
    expect(sidecarExtraHealthFlag("genre")).toBe("genre_available");
    expect(sidecarExtraHealthFlag("cover-ref")).toBe("cover_ref_available");
    expect(sidecarExtraHealthFlag("vocal_ml")).toBe("vocal_ml_available");
    expect(sidecarExtraHealthFlag("vocal-ml")).toBe(null);
  });

  it("formats install results", () => {
    expect(formatSidecarExtraInstallStatus({ ok: true, extraId: "stems", mode: "installed" })).toMatch(
      /Installed stems/i,
    );
    expect(
      formatSidecarExtraInstallStatus({
        ok: false,
        mode: "copied-command",
        message: "Copied hint",
      }),
    ).toBe("Copied hint");
    expect(
      formatSidecarExtraInstallStatus({
        ok: false,
        mode: "bundled-readonly",
        error: "frozen",
      }),
    ).toBe("frozen");
    expect(
      formatSidecarExtraInstallStatus({
        ok: false,
        mode: "install-timeout",
        error: "Install timed out after 20 minutes",
      }),
    ).toMatch(/timed out/i);
    expect(formatSidecarExtraInstallStatus({ ok: false, error: "boom" })).toBe("boom");
  });

  it("exports probe helper for desktop preflight", async () => {
    const { probeSidecarExtraInstallEnv } = await import("../app/lib/sidecar-extra-install-client.js");
    const env = await probeSidecarExtraInstallEnv();
    expect(env).toMatchObject({
      mode: expect.any(String),
      writable: expect.any(Boolean),
      message: expect.any(String),
    });
  });

  it("detects pip-capable install env modes", async () => {
    const { sidecarExtraInstallEnvAllowsPip } = await import("../app/lib/sidecar-extra-install-client.js");
    expect(sidecarExtraInstallEnvAllowsPip({ mode: "writable", writable: true })).toBe(true);
    expect(sidecarExtraInstallEnvAllowsPip({ mode: "user-data-bootstrap", writable: true })).toBe(true);
    expect(sidecarExtraInstallEnvAllowsPip({ mode: "bundled-readonly", writable: false })).toBe(false);
  });

  it("detects completed pip installs vs clipboard copy", () => {
    expect(sidecarExtraInstallCompleted({ ok: true, mode: "installed" })).toBe(true);
    expect(sidecarExtraInstallCompleted({ ok: false, mode: "copied-command" })).toBe(false);
    expect(sidecarExtraInstallCompleted({ ok: false, mode: "installed" })).toBe(false);
  });

  it("picks toast tone for copy vs install", () => {
    expect(sidecarExtraInstallStatusTone({ ok: true, mode: "installed" })).toBe("info");
    expect(sidecarExtraInstallStatusTone({ ok: false, mode: "copied-command" })).toBe("warning");
    expect(sidecarExtraInstallStatusTone({ ok: false, error: "nope" })).toBe("error");
  });

  it("keeps Electron script stem map aligned with allowlist", () => {
    expect(Object.keys(SCRIPT_STEM).sort()).toEqual(Object.keys(SIDECAR_EXTRA_NPM).sort());
    expect(SCRIPT_STEM.generate).toBe("install-sidecar-generate");
    expect(SCRIPT_STEM.cover).toBe("install-sidecar-cover");
    expect(SCRIPT_STEM["cover-ref"]).toBe("install-sidecar-cover-ref");
    expect(SCRIPT_STEM).not.toHaveProperty("vocal-ml");
  });

  it("busts health cache before re-fetch after install", async () => {
    fetchSidecarHealth.mockResolvedValueOnce({ generate_available: true });
    const health = await fetchSidecarHealthAfterExtraInstall();
    expect(resetSidecarHealthCache).toHaveBeenCalledTimes(1);
    expect(fetchSidecarHealth).toHaveBeenCalledTimes(1);
    expect(health).toEqual({ generate_available: true });
  });

  it("returns null when post-install health fetch throws", async () => {
    fetchSidecarHealth.mockRejectedValueOnce(new Error("offline"));
    await expect(fetchSidecarHealthAfterExtraInstall()).resolves.toBeNull();
    expect(resetSidecarHealthCache).toHaveBeenCalledTimes(1);
  });

  it("polls until the extra health flag becomes ready", async () => {
    fetchSidecarHealth
      .mockResolvedValueOnce({ generate_available: false })
      .mockResolvedValueOnce({ generate_available: false })
      .mockResolvedValueOnce({ generate_available: true });

    const health = await waitForSidecarExtraReady("generate", { timeoutMs: 5_000, intervalMs: 1 });
    expect(health).toEqual({ generate_available: true });
    expect(fetchSidecarHealth.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(resetSidecarHealthCache.mock.calls.length).toBe(fetchSidecarHealth.mock.calls.length);
  });

  it("stops polling when flag never becomes ready", async () => {
    fetchSidecarHealth.mockResolvedValue({ generate_available: false });
    const health = await waitForSidecarExtraReady("generate", { timeoutMs: 30, intervalMs: 5 });
    expect(health).toEqual({ generate_available: false });
    expect(fetchSidecarHealth.mock.calls.length).toBeGreaterThan(1);
  });
});
