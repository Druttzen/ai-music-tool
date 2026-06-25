import { describe, it, expect } from "vitest";
import { mergeSidecarAnalysis } from "../app/lib/audio-analyzer-sidecar.js";
import { getAudioAnalyzerDisclaimer } from "../app/lib/analyzer-disclaimer.js";

const baseReport = {
  version: 2,
  fileName: "test.wav",
  duration: 120,
  energy: 60,
  aggression: 50,
  brightness: 55,
  darkness: 45,
  complexity: 50,
  bpm: 128,
  estimatedBpm: "128 BPM",
  estimatedKey: "C major",
  spectralCentroidHz: 1500,
  highlightStart: 30,
  highlightEnd: 60,
  highlightLabel: "Peak energy section",
  suggestedGenres: ["Techno"],
  suggestedMoods: ["Dark"],
  trackSummary: "old summary",
  summary: "old",
};

describe("mergeSidecarAnalysis", () => {
  it("overrides tempo, key, centroid and marks sidecar engine", () => {
    const merged = mergeSidecarAnalysis(baseReport, {
      duration_sec: 118.5,
      tempo_bpm: 174.2,
      key_estimate: "F#",
      spectral_centroid_hz: 2200.7,
      device: "cpu",
    });

    expect(merged.bpm).toBe(174);
    expect(merged.estimatedBpm).toBe("174 BPM");
    expect(merged.estimatedKey).toBe("F#");
    expect(merged.spectralCentroidHz).toBe(2201);
    expect(merged.duration).toBe(118.5);
    expect(merged.analysisEngine).toBe("sidecar");
    expect(merged.sidecarDevice).toBe("cpu");
    expect(merged.trackSummary).toContain("Librosa");
    expect(merged.summary).toContain("174 BPM");
  });

  it("clamps extreme tempo values", () => {
    const merged = mergeSidecarAnalysis(baseReport, {
      duration_sec: 60,
      tempo_bpm: 300,
      key_estimate: "A",
      spectral_centroid_hz: 1000,
      device: "cuda",
    });
    expect(merged.bpm).toBe(200);
  });
});

describe("getAudioAnalyzerDisclaimer", () => {
  it("returns sidecar copy when analysisEngine is sidecar", () => {
    expect(getAudioAnalyzerDisclaimer({ analysisEngine: "sidecar" })).toContain("librosa");
    expect(getAudioAnalyzerDisclaimer({ analysisEngine: "heuristic" })).toContain("local scan");
    expect(getAudioAnalyzerDisclaimer(null)).toContain("local scan");
  });
});
