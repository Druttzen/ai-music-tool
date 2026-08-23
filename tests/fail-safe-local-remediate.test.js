import { describe, expect, it, vi } from "vitest";
import { buildRuntimeHealthReport } from "../app/lib/fail-safe-bot.js";
import { collectAppSubsystemSnapshot } from "../app/lib/fail-safe-app-probes.js";
import {
  isSafeScratchStorageKey,
  remediateRuntimeIssues,
  shouldAutoRemediate,
} from "../app/lib/fail-safe-local-remediate.js";
import { FAIL_SAFE_STORAGE_KEY } from "../app/lib/fail-safe-bot.js";
import { VOCAL_ALIGN_PREVIEW_STORAGE_KEY } from "../app/lib/vocal-embed-handoff.js";
import { STORAGE_KEY, HISTORY_KEY, PRESET_KEY } from "../app/lib/music-config.js";

describe("fail-safe-local-remediate", () => {
  it("never treats project / history / presets as scratch", () => {
    expect(isSafeScratchStorageKey(STORAGE_KEY)).toBe(false);
    expect(isSafeScratchStorageKey(HISTORY_KEY)).toBe(false);
    expect(isSafeScratchStorageKey(PRESET_KEY)).toBe(false);
    expect(isSafeScratchStorageKey(FAIL_SAFE_STORAGE_KEY)).toBe(true);
    expect(isSafeScratchStorageKey(VOCAL_ALIGN_PREVIEW_STORAGE_KEY)).toBe(true);
    expect(isSafeScratchStorageKey("aimc.failSafeRuntime.queue")).toBe(true);
  });

  it("skips auto-remediate in e2e and after a matching attempt", () => {
    expect(shouldAutoRemediate({ e2e: true, issueIds: ["sidecar_offline"] })).toBe(false);
    expect(shouldAutoRemediate({ issueIds: [] })).toBe(false);
    expect(
      shouldAutoRemediate({
        issueIds: ["sidecar_offline"],
        fingerprint: "sidecar_offline",
        attemptedFingerprint: "sidecar_offline",
      }),
    ).toBe(false);
    expect(shouldAutoRemediate({ issueIds: ["sidecar_offline"], fingerprint: "sidecar_offline" })).toBe(
      true,
    );
  });

  it("wakes sidecar locally without git", async () => {
    const waitForSidecar = vi.fn(async () => true);
    const result = await remediateRuntimeIssues([{ id: "sidecar_offline" }], { waitForSidecar });
    expect(waitForSidecar).toHaveBeenCalled();
    expect(result.ok).toBe(true);
    expect(result.repaired).toEqual(["sidecar_offline"]);
    expect(result.remaining).toEqual([]);
  });

  it("evicts only scratch keys on storage quota", async () => {
    const removed = [];
    const result = await remediateRuntimeIssues([{ id: "storage_quota" }], {
      listStorageKeys: () => [
        STORAGE_KEY,
        HISTORY_KEY,
        "aimc.failSafeRuntime.queue",
        FAIL_SAFE_STORAGE_KEY,
      ],
      removeStorageKey: (key) => removed.push(key),
      probeStorage: () => ({ ok: true, reason: null }),
    });
    expect(removed).toEqual(["aimc.failSafeRuntime.queue", FAIL_SAFE_STORAGE_KEY]);
    expect(removed).not.toContain(STORAGE_KEY);
    expect(result.ok).toBe(true);
  });

  it("retries crashed panels and clears faults", async () => {
    const retryUi = vi.fn(() => true);
    const clearFaults = vi.fn();
    const result = await remediateRuntimeIssues([{ id: "react_render" }], {
      retryUi,
      clearFaults,
    });
    expect(retryUi).toHaveBeenCalled();
    expect(clearFaults).toHaveBeenCalled();
    expect(result.ok).toBe(true);
  });

  it("leaves audio/canvas issues for the safe fallback", async () => {
    const result = await remediateRuntimeIssues([{ id: "audio_context" }, { id: "canvas_unavailable" }]);
    expect(result.ok).toBe(false);
    expect(result.remaining).toEqual(["audio_context", "canvas_unavailable"]);
  });

  it("feeds probe snapshot field names the health report actually reads", () => {
    const snap = collectAppSubsystemSnapshot();
    expect(snap).toHaveProperty("storageOk");
    expect(snap).toHaveProperty("audioContextAvailable");
    expect(snap).toHaveProperty("canvasAvailable");
    expect(snap).toHaveProperty("localFaults");
    const report = buildRuntimeHealthReport({
      sidecarAiStatus: "ready",
      sidecarGenerateAvailable: true,
      sidecarHealth: { librosa_available: true },
      appSubsystems: {
        ...snap,
        storageOk: false,
        storageReason: "quota",
        audioContextAvailable: false,
        canvasAvailable: false,
        localFaults: [{ source: "react:center", message: "boom" }],
      },
    });
    expect(report.issues.map((i) => i.id)).toEqual(
      expect.arrayContaining(["storage_quota", "audio_context", "canvas_unavailable", "react_render"]),
    );
  });
});
