import { describe, expect, it, beforeEach } from "vitest";
import {
  claimLaunchScan,
  resetLaunchScanGateForTests,
  shouldRunLaunchScan,
  shouldWakeForSidecarOffline,
  resolveFailSafeStripState,
} from "../app/lib/fail-safe-hibernate.js";

describe("fail-safe-hibernate", () => {
  beforeEach(() => {
    resetLaunchScanGateForTests();
  });

  it("runs the launch scan once sidecar is past checking", () => {
    expect(shouldRunLaunchScan({ mounted: true, sidecarAiStatus: "checking" })).toBe(false);
    expect(shouldRunLaunchScan({ mounted: true, sidecarAiStatus: "ready" })).toBe(true);
    expect(shouldRunLaunchScan({ mounted: false, sidecarAiStatus: "ready" })).toBe(false);
  });

  it("claims the launch scan only once per session", () => {
    expect(claimLaunchScan()).toBe(true);
    expect(claimLaunchScan()).toBe(false);
  });

  it("wakes when sidecar newly goes offline after a successful scan", () => {
    expect(
      shouldWakeForSidecarOffline({
        alreadyScanned: true,
        previousStatus: "ready",
        sidecarAiStatus: "offline",
      }),
    ).toBe(true);
    expect(
      shouldWakeForSidecarOffline({
        alreadyScanned: true,
        previousStatus: "checking",
        sidecarAiStatus: "offline",
      }),
    ).toBe(true);
    expect(
      shouldWakeForSidecarOffline({
        alreadyScanned: false,
        previousStatus: "ready",
        sidecarAiStatus: "offline",
      }),
    ).toBe(false);
  });

  it("shows recorded errors instead of sidecar checking on the Fail-Safe strip", () => {
    expect(
      resolveFailSafeStripState({
        mounted: true,
        busy: false,
        hibernating: true,
        topIssue: { title: "Sidecar extra / addon install failed" },
      }).statusLabel,
    ).toBe("Sidecar extra / addon install failed");
    expect(
      resolveFailSafeStripState({
        mounted: true,
        busy: true,
        hibernating: false,
        topIssue: { title: "Autosave failed" },
      }).checking,
    ).toBe(false);
    expect(
      resolveFailSafeStripState({
        mounted: true,
        busy: true,
        hibernating: false,
        topIssue: null,
      }).statusLabel,
    ).toBe("checking…");
  });
});
