import { describe, expect, it, vi } from "vitest";
import { buildRuntimeHealthReport } from "../app/lib/fail-safe-bot.js";
import { collectAppSubsystemSnapshot } from "../app/lib/fail-safe-app-probes.js";
import {
  isSafeScratchStorageKey,
  remediateRuntimeIssues,
  shouldAutoRemediate,
  verifyLocalRepair,
} from "../app/lib/fail-safe-local-remediate.js";
import { FAIL_SAFE_STORAGE_KEY } from "../app/lib/fail-safe-bot.js";
import { VOCAL_ALIGN_PREVIEW_STORAGE_KEY } from "../app/lib/vocal-embed-handoff.js";
import { STORAGE_KEY, HISTORY_KEY, PRESET_KEY } from "../app/lib/music-config.js";
import { beginSidecarInstallBatch } from "../app/lib/sidecar-install-activity.js";

describe("fail-safe-local-remediate", () => {
  it("repairs named plugins sequentially and preserves failed results", async () => {
    const repairExtra = vi.fn().mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false, error: "Network unavailable" });
    const result = await remediateRuntimeIssues([
      { id: "sidecar_extra_install", extraId: "stems", error: "Download interrupted" },
      { id: "sidecar_extra_install", extraId: "vision", error: "Download interrupted" },
    ], { repairExtra });
    expect(repairExtra.mock.calls).toEqual([["stems"], ["vision"]]);
    expect(result.ok).toBe(false);
    expect(result.steps.map((step) => step.ok)).toEqual([true, false]);
    expect(result.steps[1].detail).toBe("Network unavailable");
  });

  it("waits until Download all finishes before repairing a failed addon", async () => {
    const finish = beginSidecarInstallBatch();
    const repairExtra = vi.fn(async () => ({ ok: true }));
    const pending = remediateRuntimeIssues([{ id: "sidecar_extra_install", extraId: "stems" }], { repairExtra });
    await Promise.resolve();
    expect(repairExtra).not.toHaveBeenCalled();
    finish();
    expect((await pending).ok).toBe(true);
  });

  it("explains gated-model access instead of retrying unauthorized downloads", async () => {
    const repairExtra = vi.fn();
    const result = await remediateRuntimeIssues([{ id: "sidecar_extra_install", extraId: "cover",
      error: "GatedRepoError: 401 Unauthorized https://huggingface.co/black-forest-labs/FLUX.1-schnell/resolve/main/model_index.json" }], { repairExtra });
    expect(repairExtra).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    expect(result.steps[0].actionUrl).toBe("https://huggingface.co/black-forest-labs/FLUX.1-schnell");
    expect(result.steps[0].detail).toContain("cannot grant account access");
  });

  it("does not guess a plugin from a batch summary or execute an unknown identifier", async () => {
    const repairExtra = vi.fn();
    const result = await remediateRuntimeIssues([
      { id: "sidecar_extra_install", detail: "4 failed" },
      { id: "sidecar_extra_install", extraId: "../../untrusted" },
    ], { repairExtra });
    expect(repairExtra).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
  });
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

  it("accepts only a verified panel recovery without clearing unrelated faults", async () => {
    const retryUi = vi.fn(() => true);
    const clearFaults = vi.fn();
    const result = await remediateRuntimeIssues([{ id: "react_render" }], {
      retryUi,
      clearFaults,
    });
    expect(retryUi).toHaveBeenCalled();
    expect(clearFaults).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
  });

  it("does not claim a caught operation error was repaired by retrying panels", async () => {
    const retryUi = vi.fn(() => true);
    const result = await remediateRuntimeIssues([{ id: "unhandled_exception" }], { retryUi });
    expect(result.ok).toBe(false);
    expect(retryUi).not.toHaveBeenCalled();
  });

  it("keeps a failed panel retry active", async () => {
    const result = await remediateRuntimeIssues([{ id: "react_render" }], { retryUi: async () => false });
    expect(result.ok).toBe(false);
    expect(result.remaining).toEqual(["react_render"]);
  });

  it("requires a fresh health report before claiming repair success", () => {
    const result = { ok: true, repaired: ["sidecar_offline"], remaining: [], steps: [] };
    expect(verifyLocalRepair(result, null).ok).toBe(false);
    expect(verifyLocalRepair(result, { issues: [{ id: "sidecar_offline", severity: "warn" }] }).ok).toBe(false);
    expect(verifyLocalRepair(result, { issues: [{ id: "runtime_ok", severity: "ok" }] }).ok).toBe(true);
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
