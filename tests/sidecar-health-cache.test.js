import { describe, it, expect } from "vitest";
import {
  HEALTH_FAIL_TTL_MS,
  HEALTH_OK_TTL_MS,
  remainingSidecarWaitMs,
  shouldReuseHealthCache,
  sidecarHttpHealthIsUsable,
} from "../app/lib/sidecar-bridge.ts";

describe("shouldReuseHealthCache", () => {
  it("reuses successful probes for the long TTL", () => {
    const now = 10_000;
    const cache = { ok: true, at: now - 1000 };
    expect(shouldReuseHealthCache(cache, now)).toBe(true);
    expect(shouldReuseHealthCache(cache, now + HEALTH_OK_TTL_MS + 1)).toBe(false);
  });

  it("reuses failed probes only for the short TTL", () => {
    const now = 20_000;
    const cache = { ok: false, at: now - 400 };
    expect(shouldReuseHealthCache(cache, now)).toBe(true);
    expect(shouldReuseHealthCache(cache, now + HEALTH_FAIL_TTL_MS + 1)).toBe(false);
  });

  it("returns false when cache is empty", () => {
    expect(shouldReuseHealthCache(null, Date.now())).toBe(false);
  });
});

describe("sidecarHttpHealthIsUsable", () => {
  it("accepts any /health in the browser", () => {
    expect(sidecarHttpHealthIsUsable({ isTauri: false, owned: false })).toBe(true);
    expect(sidecarHttpHealthIsUsable({ isTauri: false, owned: undefined })).toBe(true);
  });

  it("requires owned=true in Studio for analysis health", () => {
    expect(sidecarHttpHealthIsUsable({ isTauri: true, owned: true })).toBe(true);
    expect(sidecarHttpHealthIsUsable({ isTauri: true, owned: false })).toBe(false);
    expect(sidecarHttpHealthIsUsable({ isTauri: true, owned: undefined })).toBe(false);
  });
});

describe("remainingSidecarWaitMs", () => {
  it("shares one deadline between spawn and HTTP poll", () => {
    const timeout = 45_000;
    const start = 1_000_000;
    const deadline = start + timeout;
    expect(remainingSidecarWaitMs(deadline, start)).toBe(timeout);
    expect(remainingSidecarWaitMs(deadline, start + 30_000)).toBe(15_000);
    expect(remainingSidecarWaitMs(deadline, start + timeout)).toBe(0);
    expect(remainingSidecarWaitMs(deadline, start + timeout + 5_000)).toBe(0);
  });
});
