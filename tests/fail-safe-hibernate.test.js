import { describe, expect, it, beforeEach } from "vitest";
import {
  claimLaunchScan,
  resetLaunchScanGateForTests,
  shouldRunLaunchScan,
  shouldWakeForSidecarOffline,
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
    ).toBe(false);
    expect(
      shouldWakeForSidecarOffline({
        alreadyScanned: false,
        previousStatus: "ready",
        sidecarAiStatus: "offline",
      }),
    ).toBe(false);
  });
});
