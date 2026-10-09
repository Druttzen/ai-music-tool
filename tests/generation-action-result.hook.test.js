/** @vitest-environment happy-dom */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useAnalyzerGenerate } from "../app/hooks/analyzers/use-analyzer-generate";
import { fetchSidecarHealth, generateMusicViaSidecar, SidecarJobCancelledError, waitForSidecar } from "../app/lib/sidecar-bridge";

vi.mock("../app/lib/sidecar-bridge", () => ({
  cancelSidecarJob: vi.fn(), waitForSidecar: vi.fn(), fetchSidecarHealth: vi.fn(),
  generateMusicViaSidecar: vi.fn(), generateMusicWithMelodyViaSidecar: vi.fn(), generateSongViaSidecar: vi.fn(),
  SidecarJobCancelledError: class SidecarJobCancelledError extends Error {},
}));
vi.mock("../app/lib/dsp-bridge", () => ({ isTauriApp: () => false }));
vi.mock("../app/lib/fail-safe-runtime-capture", () => ({ reportCaughtError: vi.fn() }));

function setup() {
  return renderHook(() => useAnalyzerGenerate({
    audioAnalysis: null, setAudioAnalysis: vi.fn(), setAudioPreviewFromBlob: vi.fn(),
    syncCacheKeysRef: vi.fn(), audioPreviewUrlRef: { current: null }, applyAnalyzerPatch: vi.fn(),
    promptEngine: "Standard", setGuidedStep: vi.fn(), setSidecarGenerateAvailable: vi.fn(), setStatusWithTime: vi.fn(),
  }));
}

describe("generation action result", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    waitForSidecar.mockResolvedValue(true);
    fetchSidecarHealth.mockResolvedValue({ generate_available: true });
  });

  it("returns failed for an empty prompt", async () => {
    const { result } = setup();
    expect(await result.current.generateMusicFromPrompt("")).toMatchObject({ status: "failed" });
  });

  it.each(["offline", "missing model"])("returns failed when %s", async (reason) => {
    if (reason === "offline") waitForSidecar.mockResolvedValue(false);
    else fetchSidecarHealth.mockResolvedValue({ generate_available: false });
    const { result } = setup();
    let value;
    await act(async () => { value = await result.current.generateMusicFromPrompt("test"); });
    expect(value.status).toBe("failed");
    expect(generateMusicViaSidecar).not.toHaveBeenCalled();
  });

  it("returns the actual job and artifact summary after completion", async () => {
    generateMusicViaSidecar.mockImplementation(async (_prompt, _duration, options) => {
      options.onJobStarted("job-123");
      return { blob: new Blob(["audio"], { type: "audio/wav" }), model: "small", durationSec: 10, mode: "text" };
    });
    const started = vi.fn();
    const { result } = setup();
    let value;
    await act(async () => { value = await result.current.generateMusicFromPrompt("test", 10, { attach: false, onJobStarted: started }); });
    expect(started).toHaveBeenCalledWith("job-123");
    expect(value).toMatchObject({ status: "completed", jobId: "job-123", artifact: { kind: "audio", model: "small", durationSec: 10 } });
    expect(value.artifact.fileName).toMatch(/\.wav$/);
  });

  it.each(["cancelled", "failed"])("preserves %s without reporting completion", async (status) => {
    generateMusicViaSidecar.mockImplementation(async (_prompt, _duration, options) => {
      options.onJobStarted("job-123");
      throw status === "cancelled" ? new SidecarJobCancelledError("Cancelled") : new Error("Inference failed");
    });
    const { result } = setup();
    let value;
    await act(async () => { value = await result.current.generateMusicFromPrompt("test"); });
    expect(value).toMatchObject({ status, jobId: "job-123" });
    expect(value.artifact).toBeUndefined();
  });
});
