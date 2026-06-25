import { describe, it, expect } from "vitest";
import {
  HEALTH_FAIL_TTL_MS,
  HEALTH_OK_TTL_MS,
  shouldReuseHealthCache,
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
