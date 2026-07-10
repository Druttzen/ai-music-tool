import { describe, expect, it } from "vitest";
import { isSupportedAudioFile, SUPPORTED_AUDIO_LABEL } from "../app/lib/analyzer-file-types.js";
import {
  buildSidecarFallbackReport,
  mergeSidecarAnalysis,
} from "../app/lib/audio-analyzer-sidecar.js";
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
      key_confidence: 0.31,
      spectral_centroid_hz: 2200.7,
      spectral_bandwidth_hz: 3100.2,
      spectral_rolloff_hz: 5200.8,
      onset_strength: 1.7,
      beat_count: 220,
      beat_density: 1.86,
      percussive_ratio: 0.64,
      harmonic_ratio: 0.36,
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
    expect(merged.trackSummary).toContain("31% key confidence");
    expect(merged.suggestedSounds).toContain("Punchy transient drums");
    expect(merged.suggestedSounds).toContain("Airy high-end sheen");
    expect(merged.suggestedRhythms).toContain("Percussive groove");
    expect(merged.sidecarFeatures.percussiveRatio).toBe(64);
    expect(merged.sidecarFeatures.spectralBandwidthHz).toBe(3100);
    expect(merged.summary).toContain("174 BPM");
  });

  it("uses HF genre predictions when sidecar returns them", () => {
    const merged = mergeSidecarAnalysis(baseReport, {
      duration_sec: 118.5,
      tempo_bpm: 128,
      key_estimate: "A",
      spectral_centroid_hz: 1800,
      device: "cpu",
      genre_model: "dima806/music_genres_classification",
      genre_predictions: [
        { label: "hiphop", score: 0.71 },
        { label: "pop", score: 0.18 },
      ],
    });

    expect(merged.analysisEngine).toBe("sidecar+hf-genre");
    expect(merged.suggestedGenres).toContain("Hip Hop");
    expect(merged.trackSummary).toContain("HF genre hiphop");
    expect(merged.hfGenreLabels).toEqual(["hiphop", "pop"]);
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
    expect(getAudioAnalyzerDisclaimer({ analysisEngine: "sidecar+hf-genre" })).toContain(
      "Hugging Face",
    );
    expect(getAudioAnalyzerDisclaimer({ analysisEngine: "sidecar+sonic" })).toContain("librosa");
    expect(getAudioAnalyzerDisclaimer({ analysisEngine: "sidecar+hf-genre+sonic" })).toContain(
      "Hugging Face",
    );
    expect(getAudioAnalyzerDisclaimer({ analysisEngine: "heuristic" })).toContain("local scan");
    expect(getAudioAnalyzerDisclaimer(null)).toContain("local scan");
  });
});

describe("analyzer-file-types", () => {
  it("accepts FLAC uploads when sidecar can decode", () => {
    expect(isSupportedAudioFile({ name: "master.flac", type: "audio/flac" })).toBe(true);
    expect(SUPPORTED_AUDIO_LABEL).toContain("FLAC");
  });
});

describe("buildSidecarFallbackReport", () => {
  it("builds a merge-ready report when browser decode is unavailable", () => {
    const report = buildSidecarFallbackReport("track.flac", {
      duration_sec: 180,
      tempo_bpm: 128.4,
      key_estimate: "A minor",
      spectral_centroid_hz: 2400,
    });
    expect(report.fileName).toBe("track.flac");
    expect(report.duration).toBe(180);
    expect(report.estimatedBpm).toBe("128 BPM");
    expect(report.analysisEngine).toBe("sidecar-fallback");
    expect(report.suggestedGenres?.length).toBeGreaterThan(0);
  });
});
