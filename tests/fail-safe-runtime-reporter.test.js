import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  canQueueRuntimeReports,
  enqueueRuntimeReport,
  formatRuntimeReportPayload,
  getRuntimeReportQueue,
  isRuntimeReportingEnabled,
  hasRuntimeTelemetryConsent,
  maybeReportHealthIssue,
  redactRuntimeLog,
  runtimeFailBranchName,
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

describe("fail-safe-runtime-reporter", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createMockStorage());
    setRuntimeReportingEnabled(false);
    setRuntimeTelemetryConsent(false);
  });

  it("defaults reporting and consent to off", () => {
    expect(isRuntimeReportingEnabled()).toBe(false);
    expect(hasRuntimeTelemetryConsent()).toBe(false);
    expect(canQueueRuntimeReports()).toBe(false);
  });

  it("formats branch name cursor/runtime-fail-*", () => {
    const name = runtimeFailBranchName({
      at: Date.UTC(2026, 6, 20),
      fingerprint: "sidecar_offline",
    });
    expect(name).toBe("cursor/runtime-fail-20260720-sidecar-offline");
  });

  it("redacts github-style tokens", () => {
    const out = redactRuntimeLog("token ghp_abcdefghijklmnopqrstuvwxyz012345 Authorization: Bearer secret");
    expect(out).toContain("[redacted-token]");
    expect(out).not.toMatch(/ghp_[A-Za-z0-9]{20,}/);
  });

  it("builds issue payload with labels and agent prompt", () => {
    const payload = formatRuntimeReportPayload({
      source: "window.onerror",
      message: "sidecar offline at 8723/health",
      stack: "Error: did not become ready",
      sidecarAiStatus: "offline",
      appVersion: "0.50.1",
    });
    expect(payload.branch).toMatch(/^cursor\/runtime-fail-/);
    expect(payload.issueTitle).toMatch(/fail-safe-runtime/);
    expect(payload.labels).toEqual(expect.arrayContaining(["fail-safe-runtime", "needs-agent"]));
    expect(payload.issueBody).toContain("FAIL-SAFE BOT");
    expect(payload.delivery).toBe("local-queue-only");
    expect(payload.issues.some((i) => i.id === "sidecar_offline")).toBe(true);
  });

  it("does not enqueue without consent", () => {
    setRuntimeReportingEnabled(true);
    const res = enqueueRuntimeReport({ message: "boom" });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("reporting-disabled-or-no-consent");
    expect(getRuntimeReportQueue()).toHaveLength(0);
  });

  it("enqueues when enable + consent", () => {
    setRuntimeReportingEnabled(true);
    setRuntimeTelemetryConsent(true);
    const res = enqueueRuntimeReport({
      source: "health:sidecar_offline",
      message: "AI sidecar offline",
      stack: "Sidecar not responding",
    });
    expect(res.ok).toBe(true);
    expect(getRuntimeReportQueue()).toHaveLength(1);
    expect(getRuntimeReportQueue()[0].branch).toMatch(/^cursor\/runtime-fail-/);
  });

  it("maybeReportHealthIssue skips informational ids", () => {
    setRuntimeReportingEnabled(true);
    setRuntimeTelemetryConsent(true);
    expect(
      maybeReportHealthIssue({
        id: "musicgen_unavailable",
        severity: "ok",
        title: "MusicGen optional",
      }).reason,
    ).toBe("not-actionable");
  });
});
