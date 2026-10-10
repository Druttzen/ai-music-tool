import { beforeEach, afterEach, expect, it, vi } from "vitest";

let storage;
beforeEach(() => {
  vi.resetModules();
  const data = new Map();
  storage = { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) };
  vi.stubGlobal("localStorage", storage);
});
afterEach(() => vi.unstubAllGlobals());

it("preserves old M4A failures as history instead of replaying them at launch", async () => {
  storage.setItem("aimc.failSafeRuntime.localFaults", JSON.stringify([{ at: 1000, source: "analyzers.separateStems", message: "Error opening tmp.m4a" }]));
  const faults = await import("../app/lib/fail-safe-runtime-fault.js");
  expect(faults.getActiveLocalFaults()).toEqual([]);
  expect(faults.getHistoricalLocalFaults()).toHaveLength(1);
  faults.recordLocalFault({ source: "analyzers.separateStems", message: "Error opening tmp.m4a" });
  expect(faults.getActiveLocalFaults()).toHaveLength(1);
  expect(faults.getLocalFaults()).toHaveLength(2);
  vi.resetModules();
  const restarted = await import("../app/lib/fail-safe-runtime-fault.js");
  expect(restarted.getActiveLocalFaults()).toEqual([]);
  expect(restarted.getHistoricalLocalFaults()).toHaveLength(2);
});

it("resolves only verified panel faults and records a repeated failure again", async () => {
  const faults = await import("../app/lib/fail-safe-runtime-fault.js");
  faults.recordLocalFault({ source: "react:center", message: "crash" });
  faults.recordLocalFault({ source: "analyzers.separateStems", message: "M4A failure" });
  faults.resolveLocalFaults((fault) => fault.source === "react:center");
  expect(faults.getActiveLocalFaults().map((fault) => fault.source)).toEqual(["analyzers.separateStems"]);
  expect(faults.getHistoricalLocalFaults()[0].resolvedAt).toBeGreaterThan(0);
  expect(faults.recordLocalFault({ source: "react:center", message: "crash" }).ok).toBe(true);
});
