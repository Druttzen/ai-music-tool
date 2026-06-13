import { describe, it, expect } from "vitest";
import {
  WAVEFORM_BAR_COUNT,
  analysisNeedsWaveformPeaks,
  buildWaveformPeaks,
  formatTime,
  normalizeHighlightRange,
  synthesizeWaveformPeaksFromAnalysis,
} from "../app/lib/audio-analyzer.js";

function sineChannel(length, freq, sampleRate) {
  const data = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    data[i] = Math.sin((2 * Math.PI * freq * i) / sampleRate) * 0.5;
  }
  return data;
}

describe("audio-analyzer", () => {
  it("buildWaveformPeaks returns fixed bar count with normalized amplitudes", () => {
    const channel = sineChannel(44100, 440, 44100);
    const peaks = buildWaveformPeaks(channel, 48);
    expect(peaks).toHaveLength(48);
    expect(Math.max(...peaks)).toBeLessThanOrEqual(1);
    expect(Math.min(...peaks)).toBeGreaterThanOrEqual(0);
  });

  it("normalizeHighlightRange clamps to track duration", () => {
    const { highlightStart, highlightEnd } = normalizeHighlightRange(120, 10, 200, 2);
    expect(highlightStart).toBe(10);
    expect(highlightEnd).toBeLessThanOrEqual(120);
    expect(highlightEnd - highlightStart).toBeGreaterThanOrEqual(2);
  });

  it("formatTime renders mm:ss", () => {
    expect(formatTime(65)).toBe("1:05");
    expect(formatTime(0)).toBe("0:00");
  });

  it("analysisNeedsWaveformPeaks detects missing peaks", () => {
    expect(analysisNeedsWaveformPeaks({ duration: 60 })).toBe(true);
    expect(analysisNeedsWaveformPeaks({ duration: 60, waveformPeaks: [0.1, 0.2] })).toBe(true);
    expect(
      analysisNeedsWaveformPeaks({
        duration: 60,
        waveformPeaks: Array.from({ length: 32 }, (_, i) => i / 32),
      }),
    ).toBe(false);
  });

  it("synthesizeWaveformPeaksFromAnalysis builds peaks from highlight window", () => {
    const peaks = synthesizeWaveformPeaksFromAnalysis({
      duration: 60,
      highlightStart: 10,
      highlightEnd: 25,
      energy: 70,
      aggression: 50,
      fileName: "test.mp3",
    });
    expect(peaks).toHaveLength(WAVEFORM_BAR_COUNT);
    expect(peaks.some((p) => p > 0)).toBe(true);
  });
});
