import { afterEach, describe, expect, it, vi } from "vitest";
import { exportMasteredNative } from "../app/lib/dsp-bridge";
import { masteringProgress } from "../app/lib/mastering-progress";

afterEach(() => vi.unstubAllGlobals());

describe("native mastering progress", () => {
  it("subscribes before starting work, correlates by job and cleans up on failure", async () => {
    let listener;
    let subscribed = false;
    const unlisten = vi.fn();
    const onProgress = vi.fn();
    const invoke = vi.fn(async (_command, args) => {
      expect(subscribed).toBe(true);
      listener({ payload: { jobId: "another-job", phase: "encoding", completed: 1, total: 1 } });
      listener({ payload: { jobId: args.jobId, phase: "mastering", completed: 48000, total: 96000 } });
      listener({ payload: { jobId: args.jobId, phase: "encoding", completed: null, total: null } });
      throw Error("encoder failed");
    });
    vi.stubGlobal("window", { __TAURI__: { core: { invoke }, event: { listen: async (_, fn) => { listener = fn; subscribed = true; return unlisten; } } } });
    await expect(exportMasteredNative(new ArrayBuffer(2), "streaming", "wav", undefined, undefined, onProgress)).rejects.toThrow("encoder failed");
    expect(onProgress.mock.calls.map(([p]) => [p.phase, p.pct])).toEqual([["mastering", 50], ["encoding", null]]);
    expect(unlisten).toHaveBeenCalledOnce();
  });

  it("supports an older host without progress events", async () => {
    vi.stubGlobal("window", { __TAURI__: { core: { invoke: vi.fn(async () => ({ wav_bytes: [] })) } } });
    await expect(exportMasteredNative(new ArrayBuffer(2), "measure", "wav")).resolves.toMatchObject({ wav_bytes: [] });
  });

  it("reports workflow steps separately from audio-frame progress", () => {
    expect(masteringProgress({ phase: "mastering", pct: 40, completed: 40, total: 100 })).toMatchObject({ completedSteps: 3, totalSteps: 8, pct: 40 });
    expect(masteringProgress({ phase: "saving", pct: null })).toMatchObject({ completedSteps: 7, pct: null, completed: null, total: null });
  });
});
