import { describe, it, expect, beforeEach, vi } from "vitest";
import { safeLocalStorage, storageFailureMessage } from "../app/lib/safe-local-storage.js";

function createMockStorage() {
  /** @type {Record<string, string>} */
  const data = {};
  return {
    getItem: vi.fn((key) => (key in data ? data[key] : null)),
    setItem: vi.fn((key, value) => {
      data[key] = value;
    }),
    removeItem: vi.fn((key) => {
      delete data[key];
    }),
    _data: data,
  };
}

describe("safeLocalStorage", () => {
  /** @type {ReturnType<typeof createMockStorage>} */
  let mock;

  beforeEach(() => {
    mock = createMockStorage();
    vi.stubGlobal("localStorage", mock);
  });

  it("reads and writes JSON", () => {
    const result = safeLocalStorage.setJSON("project", { idea: "test" });
    expect(result.ok).toBe(true);
    expect(safeLocalStorage.getJSON("project", null)).toEqual({ idea: "test" });
  });

  it("returns fallback on corrupt JSON", () => {
    mock.setItem("bad", "{not json");
    expect(safeLocalStorage.getJSON("bad", { ok: true })).toEqual({ ok: true });
  });

  it("surfaces quota errors on set", () => {
    mock.setItem.mockImplementation(() => {
      const err = new Error("QuotaExceededError");
      err.name = "QuotaExceededError";
      throw err;
    });
    const result = safeLocalStorage.setJSON("big", { x: "y".repeat(9999) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("quota");
    expect(storageFailureMessage(result)).toMatch(/Storage full/i);
  });

  it("removes keys safely", () => {
    safeLocalStorage.set("temp", "1");
    safeLocalStorage.remove("temp");
    expect(safeLocalStorage.get("temp", null)).toBeNull();
  });
});
