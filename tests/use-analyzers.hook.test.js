/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAnalyzers } from "../app/hooks/use-analyzers.js";

vi.mock("../app/lib/sidecar-bridge.js", () => ({
  isSidecarAvailable: vi.fn(async () => true),
  fetchSidecarHealth: vi.fn(async () => ({
    status: "ok",
    generate_available: true,
    stems_available: false,
  })),
  getManagedSidecarStatus: vi.fn(async () => ({ ready: false, spawned: false })),
  resetSidecarHealthCache: vi.fn(),
  waitForSidecar: vi.fn(async () => true),
  analyzeAudioViaSidecar: vi.fn(),
  analyzeImageViaSidecar: vi.fn(),
  downloadSidecarStem: vi.fn(),
  generateMusicViaSidecar: vi.fn(),
  generateMusicWithMelodyViaSidecar: vi.fn(),
  separateStemsViaSidecar: vi.fn(),
}));

vi.mock("../app/lib/dsp-bridge.js", () => ({
  isTauriApp: vi.fn(() => false),
  measureLoudnessBytes: vi.fn(),
}));

describe("useAnalyzers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("probes sidecar on mount and sets ready + generate_available", async () => {
    const setStatusWithTime = vi.fn();
    const applyAnalyzerPatch = vi.fn();

    const { result } = renderHook(() =>
      useAnalyzers({
        promptEngine: "Standard",
        setGuidedStep: vi.fn(),
        applyAnalyzerPatch,
        setStatusWithTime,
      }),
    );

    await waitFor(() => {
      expect(result.current.sidecarAiStatus).toBe("ready");
    });
    expect(result.current.sidecarGenerateAvailable).toBe(true);
  });

  it("resetAnalyzers clears audio and image state", async () => {
    const setStatusWithTime = vi.fn();
    const applyAnalyzerPatch = vi.fn();

    const { result } = renderHook(() =>
      useAnalyzers({
        promptEngine: "Standard",
        setGuidedStep: vi.fn(),
        applyAnalyzerPatch,
        setStatusWithTime,
      }),
    );

    act(() => {
      result.current.setAudioAnalysis({
        fileName: "test.wav",
        duration: 10,
        tempoBpm: 120,
        summary: "test track",
      });
      result.current.setImageAnalysis({ summary: "cover art" });
    });

    expect(result.current.audioAnalysis).toBeTruthy();
    expect(result.current.imageAnalysis).toBeTruthy();

    act(() => {
      result.current.resetAnalyzers();
    });

    expect(result.current.audioAnalysis).toBeNull();
    expect(result.current.imageAnalysis).toBeNull();
    expect(result.current.stemSeparationStems).toEqual([]);
  });
});
