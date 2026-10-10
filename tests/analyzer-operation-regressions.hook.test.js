/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { useAnalyzers } from "../app/hooks/use-analyzers";

const mocks = vi.hoisted(() => ({
  decode: vi.fn(), analyze: vi.fn(), generate: vi.fn(), stems: vi.fn(),
  vocal: vi.fn(), cover: vi.fn(), download: vi.fn(), stemDownload: vi.fn(),
  cache: vi.fn(),
}));
vi.mock("../app/lib/decode-analyzer-audio", () => ({ decodeAnalyzerAudioBuffer: mocks.decode }));
vi.mock("../app/lib/sidecar-bridge", async (original) => ({
  ...await original(),
  isSidecarAvailable: async () => true,
  waitForSidecar: async () => true,
  fetchSidecarHealth: async () => ({ generate_available: true, vocal_transform_available: true }),
  analyzeAudioViaSidecar: mocks.analyze,
  fetchSonicSignatureViaSidecar: async () => null,
  generateMusicViaSidecar: mocks.generate,
  separateStemsViaSidecar: mocks.stems,
  transformVocalsViaSidecar: mocks.vocal,
  downloadSidecarStem: mocks.stemDownload,
}));
vi.mock("../app/lib/audio-cache", async (original) => ({
  ...await original(),
  putAudioCacheEntries: async () => ({ audioCacheKey: "cached", audioLookupKey: "lookup" }),
  deleteAudioCacheEntries: async () => {},
  resolveAudioCacheBlob: async () => ({ blob: new Blob(["wav"]) }),
}));
vi.mock("../app/lib/audio-analyzer", async (original) => ({
  ...await original(),
  analyzeAudioBuffer: (buffer, fileName) => ({ fileName, duration: buffer.duration, waveformPeaks: [1] }),
  decodeWaveformPeaksFromBlob: async () => [1],
  analysisNeedsWaveformPeaks: () => false,
}));
vi.mock("../app/lib/generated-audio-cache", () => ({ cacheGeneratedAudioDraft: mocks.cache }));
vi.mock("../app/lib/musicgen-preview", () => ({
  buildMusicGenAnalysisReport: async (_file, options) => ({ fileName: options.fileName, duration: 1, waveformPeaks: [1] }),
  enrichMusicGenReportWithSidecar: async (_file, report) => report,
  downloadMusicGenBlob: mocks.download,
}));
vi.mock("../app/lib/local-cover-remix-engine", () => ({ runLocalCoverRemixJob: mocks.cover }));
vi.mock("../app/lib/dsp-bridge", async (original) => ({ ...await original(), isTauriApp: () => false }));

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function mount() {
  const status = vi.fn();
  const patch = vi.fn();
  const hook = renderHook(() => useAnalyzers({ setStatusWithTime: status,
    applyAnalyzerPatch: patch, setGuidedStep: vi.fn(), promptEngine: "Standard" }));
  return { ...hook, status, patch };
}
async function load(result, name = "original.wav") {
  await act(async () => result.current.setAudioAnalysis({ fileName: name, duration: 1, audioCacheKey: name, waveformPeaks: [1] }));
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, blob: async () => new Blob(["wav"]) })));
  mocks.cache.mockImplementation(async (_file, report) => ({ ...report, audioCacheKey: "generated-cache", audioLookupKey: "generated-lookup" }));
  mocks.analyze.mockResolvedValue({ duration_sec: 1, tempo_bpm: 120 });
  mocks.download.mockResolvedValue("saved.wav");
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("analyzer source ownership", () => {
  it("clear discards a late audio decode and permits a new analysis", async () => {
    const pending = deferred();
    mocks.decode.mockReturnValueOnce(pending.promise);
    const { result } = mount();
    let work;
    act(() => { work = result.current.analyzeAudioFile(new File(["wav"], "late.wav")); });
    await waitFor(() => expect(mocks.decode).toHaveBeenCalled());
    act(() => result.current.clearAudioAnalysis());
    expect(result.current.analyzeAudioBusy).toBe(false);
    await act(async () => { pending.resolve({ buffer: { duration: 1 } }); await work; });
    expect(result.current.audioAnalysis).toBeNull();
    expect(result.current.audioPreviewUrl).toBeNull();
  });

  it("a project replacement discards a late sidecar audio result", async () => {
    const pending = deferred();
    mocks.decode.mockResolvedValue({ buffer: { duration: 1 } });
    mocks.analyze.mockReturnValueOnce(pending.promise);
    const { result } = mount();
    let work;
    act(() => { work = result.current.analyzeAudioFile(new File(["wav"], "late.wav")); });
    await waitFor(() => expect(mocks.analyze).toHaveBeenCalled());
    await load(result, "new-project.wav");
    await act(async () => { pending.resolve({ duration_sec: 1 }); await work; });
    expect(result.current.audioAnalysis.fileName).toBe("new-project.wav");
  });

  it("reset discards a late decoded image", async () => {
    const images = [];
    vi.stubGlobal("Image", class { constructor() { this.width = this.height = 160; images.push(this); } set src(_url) {} });
    const { result } = mount();
    result.current.canvasRef.current = { getContext: () => ({ drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray([255, 0, 0, 255]) }) }) };
    let work;
    act(() => { work = result.current.analyzeImageFile(new File(["png"], "late.png")); });
    act(() => result.current.resetAnalyzers());
    await act(async () => { images[0].onload(); await work; });
    expect(result.current.imageAnalysis).toBeNull();
    expect(result.current.imagePreview).toBeNull();
  });

  it("reset discards a generated track and its automatic style merge", async () => {
    const pending = deferred();
    mocks.generate.mockReturnValueOnce(pending.promise);
    const { result, patch } = mount();
    let work;
    act(() => { work = result.current.generateMusicFromPrompt("test music", 1); });
    await waitFor(() => expect(mocks.generate).toHaveBeenCalled());
    act(() => result.current.resetAnalyzers());
    await act(async () => { pending.resolve({ blob: new Blob(["wav"]), model: "small", durationSec: 1 }); await work; });
    expect(result.current.audioAnalysis).toBeNull();
    expect(patch).not.toHaveBeenCalled();
  });

  it("stems retain source identity and disappear after loading another track", async () => {
    mocks.stems.mockResolvedValue({ stems: [{ name: "vocals", filename: "vocals.wav", download_url: "/vocals" }], sources: ["vocals"], model: "melband-clean", job_id: "take123" });
    const { result } = mount();
    await load(result);
    await act(async () => result.current.separateStems("melband-clean"));
    const stem = result.current.stemSeparationStems[0];
    await act(async () => result.current.downloadStem(stem));
    expect(mocks.stemDownload).toHaveBeenCalledWith("/vocals", "original-melband-clean-take123-vocals.wav");
    await load(result, "replacement.wav");
    expect(result.current.stemSeparationStems).toEqual([]);
    await act(async () => result.current.downloadStem(stem));
    expect(mocks.stemDownload).toHaveBeenCalledTimes(1);
  });

  it("a late stem result cannot attach to another track", async () => {
    const pending = deferred();
    mocks.stems.mockReturnValueOnce(pending.promise);
    const { result } = mount();
    await load(result);
    let work;
    act(() => { work = result.current.separateStems(); });
    await waitFor(() => expect(mocks.stems).toHaveBeenCalled());
    await load(result, "replacement.wav");
    await act(async () => { pending.resolve({ stems: [{ filename: "vocals.wav" }], sources: ["vocals"] }); await work; });
    expect(result.current.stemSeparationStems).toEqual([]);
  });
});

describe("generated vocal and cover storage", () => {
  it("caches vocal remix and waits for acapella export before finishing", async () => {
    const pending = deferred();
    mocks.vocal.mockResolvedValue({ remixBlob: new Blob(["mix"]), vocalsBlob: new Blob(["voice"]), mode: "pitch" });
    mocks.download.mockReturnValueOnce(pending.promise);
    const { result, status } = mount();
    await load(result);
    let work;
    act(() => { work = result.current.transformVocalsOnTrack(); });
    await waitFor(() => expect(mocks.download).toHaveBeenCalled());
    expect(result.current.vocalTransformBusy).toBe(true);
    expect(result.current.audioAnalysis.audioCacheKey).toBe("generated-cache");
    await act(async () => { pending.resolve("saved.wav"); await work; });
    expect(result.current.vocalTransformBusy).toBe(false);
    expect(status).toHaveBeenLastCalledWith(expect.stringContaining("acapella downloaded"), "success");
  });

  it("reports failed vocal export instead of a false success", async () => {
    mocks.vocal.mockResolvedValue({ vocalsBlob: new Blob(["voice"]), mode: "pitch" });
    mocks.download.mockRejectedValueOnce(new Error("Disk full"));
    const { result, status } = mount();
    await load(result);
    await act(async () => result.current.transformVocalsOnTrack());
    expect(status).toHaveBeenLastCalledWith("Disk full", "warning");
  });

  it("caches local covers, awaits export and rejects duplicate clicks", async () => {
    const pending = deferred();
    mocks.cover.mockResolvedValue({ blob: new Blob(["cover"]), fileName: "cover.wav", model: "small", engine: "musicgen", mode: "cover", dna: { prompt: "test" } });
    mocks.download.mockReturnValueOnce(pending.promise);
    const { result } = mount();
    await load(result);
    let work;
    act(() => { work = result.current.runLocalCoverRemix({ download: true }); });
    await waitFor(() => expect(mocks.download).toHaveBeenCalled());
    expect(result.current.localCoverRemixBusy).toBe(true);
    expect(result.current.audioAnalysis.audioCacheKey).toBe("generated-cache");
    await act(async () => result.current.runLocalCoverRemix({ download: true }));
    expect(mocks.cover).toHaveBeenCalledTimes(1);
    await act(async () => { pending.resolve("saved.wav"); await work; });
    expect(result.current.localCoverRemixBusy).toBe(false);
  });

  it("surfaces local cover cache failure while preserving the playable draft", async () => {
    mocks.cover.mockResolvedValue({ blob: new Blob(["cover"]), fileName: "cover.wav", engine: "musicgen", mode: "cover", dna: { prompt: "test" } });
    mocks.cache.mockImplementationOnce(async (_file, report) => ({ ...report, audioCacheWarning: "Export before closing" }));
    const { result, status } = mount();
    await load(result);
    await act(async () => result.current.runLocalCoverRemix());
    expect(result.current.audioAnalysis.sourceEngine).toBe("local-musicgen");
    expect(status).toHaveBeenLastCalledWith("Export before closing", "warning");
  });
});
