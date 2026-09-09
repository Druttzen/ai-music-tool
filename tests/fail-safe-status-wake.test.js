import { describe, expect, it, beforeEach, vi } from "vitest";
import { shouldRecordStatusAsFault } from "../app/lib/fail-safe-runtime-capture.js";
import { clearLocalFaults, getLocalFaults, recordLocalFault } from "../app/lib/fail-safe-runtime-fault.js";

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

describe("fail-safe status wake", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createMockStorage());
    clearLocalFaults();
  });

  it("records error toasts and failure-like warnings, not validation hints", () => {
    expect(shouldRecordStatusAsFault("error", "Autosave failed")).toBe(true);
    expect(shouldRecordStatusAsFault("warning", "YouTube resolve failed — sidecar offline")).toBe(true);
    expect(shouldRecordStatusAsFault("warning", "Start the librosa sidecar (npm run sidecar) first")).toBe(
      true,
    );
    expect(shouldRecordStatusAsFault("warning", "Enter a MusicGen prompt first")).toBe(false);
    expect(shouldRecordStatusAsFault("success", "Saved")).toBe(false);
    expect(shouldRecordStatusAsFault("info", "Installing sidecar extra (stems)…")).toBe(false);
  });

  it("dedupes the same toast message even when the source differs", () => {
    expect(recordLocalFault({ source: "ui.status", message: "pip failed" }).ok).toBe(true);
    expect(recordLocalFault({ source: "addons.install:stems", message: "pip failed" }).ok).toBe(false);
    expect(getLocalFaults()).toHaveLength(1);
    expect(getLocalFaults()[0].source).toBe("ui.status");
  });
});
