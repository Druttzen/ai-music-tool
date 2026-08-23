import { describe, expect, it, beforeEach, vi } from "vitest";
import { failSafeCall, failSafeFn, failSafeWrapHandlers } from "../app/lib/fail-safe-invoke.js";
import { clearLocalFaults, getLocalFaults } from "../app/lib/fail-safe-runtime-fault.js";

function createMockStorage() {
  /** @type {Record<string, string>} */
  const data = {};
  return {
    getItem: vi.fn((key) => (key in data ? data[key] : null)),
    setItem: vi.fn((key, value) => {
      data[key] = String(value);
    }),
    removeItem: vi.fn((key) => {
      delete data[key];
    }),
  };
}

describe("fail-safe-invoke", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createMockStorage());
    clearLocalFaults();
  });

  it("returns the function result when it succeeds", () => {
    expect(failSafeCall(() => 42, "test.ok")).toBe(42);
  });

  it("returns fallback and records a local fault when it throws", () => {
    const value = failSafeCall(() => {
      throw new Error("boom");
    }, "test.throw", "safe");
    expect(value).toBe("safe");
    expect(getLocalFaults()[0].source).toBe("test.throw");
    expect(getLocalFaults()[0].message).toBe("boom");
  });

  it("swallows async rejection and returns fallback", async () => {
    const value = await failSafeCall(
      () => Promise.reject(new Error("nope")),
      "test.async",
      null,
    );
    expect(value).toBeNull();
    expect(getLocalFaults().some((f) => f.source === "test.async")).toBe(true);
  });

  it("wraps handler maps without changing successful results", () => {
    const wrapped = failSafeWrapHandlers(
      {
        add: (a, b) => a + b,
        explode: () => {
          throw new Error("explode");
        },
      },
      "handlers",
    );
    expect(wrapped.add(2, 3)).toBe(5);
    expect(wrapped.explode()).toBeUndefined();
    expect(getLocalFaults()[0].source).toBe("handlers.explode");
  });

  it("failSafeFn preserves this and arguments", () => {
    const fn = failSafeFn(function add(n) {
      return this.base + n;
    }, "obj.add");
    expect(fn.call({ base: 10 }, 5)).toBe(15);
  });
});
