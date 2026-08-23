import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  areRuntimeErrorListenersInstalled,
  installRuntimeErrorListeners,
  uninstallRuntimeErrorListeners,
} from "../app/lib/fail-safe-runtime-listeners.js";
import { clearLocalFaults, getLocalFaults } from "../app/lib/fail-safe-runtime-fault.js";
import {
  canQueueRuntimeReports,
  clearRuntimeReportQueue,
  getRuntimeReportQueue,
  setRuntimeReportingEnabled,
  setRuntimeTelemetryConsent,
} from "../app/lib/fail-safe-runtime-reporter.js";

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

function stubWindow() {
  const target = new EventTarget();
  const fake = {
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
    dispatchEvent: target.dispatchEvent.bind(target),
  };
  vi.stubGlobal("window", fake);
  return fake;
}

function dispatchWindowError(message, error) {
  const event = new Event("error");
  Object.assign(event, { message, error: error || new Error(message) });
  window.dispatchEvent(event);
}

describe("fail-safe-runtime-listeners", () => {
  beforeEach(() => {
    uninstallRuntimeErrorListeners();
    vi.stubGlobal("localStorage", createMockStorage());
    clearLocalFaults();
    clearRuntimeReportQueue();
    setRuntimeReportingEnabled(false);
    setRuntimeTelemetryConsent(false);
    stubWindow();
  });

  it("installs even when GitHub reporting is off and records local faults", () => {
    expect(canQueueRuntimeReports()).toBe(false);
    const res = installRuntimeErrorListeners({ appVersion: "test" });
    expect(res.ok).toBe(true);
    expect(areRuntimeErrorListenersInstalled()).toBe(true);

    dispatchWindowError("studio exploded", new Error("studio exploded"));
    expect(getLocalFaults()[0].message).toContain("studio exploded");
    expect(getRuntimeReportQueue()).toHaveLength(0);
  });

  it("queues a GitHub report only when enable + consent are on", () => {
    setRuntimeReportingEnabled(true);
    setRuntimeTelemetryConsent(true);
    installRuntimeErrorListeners();
    dispatchWindowError("sidecar offline at 8723/health", new Error("x"));
    expect(getRuntimeReportQueue().length).toBeGreaterThan(0);
  });

  it("ignores ResizeObserver noise", () => {
    installRuntimeErrorListeners();
    dispatchWindowError("ResizeObserver loop completed with undelivered notifications.");
    expect(getLocalFaults()).toHaveLength(0);
  });
});
