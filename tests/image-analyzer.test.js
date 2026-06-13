import { describe, it, expect } from "vitest";
import {
  analyzeImagePixelData,
  buildImageAnalysis,
  computeImagePixelStats,
} from "../app/lib/image-analyzer.js";
import { isCatalogGenre } from "../app/lib/analyzer-suggestions.js";

function solidRgba(width, height, r, g, b, a = 255) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = a;
  }
  return data;
}

describe("image-analyzer", () => {
  it("maps dark pixels to high darkness mood", () => {
    const rgba = solidRgba(4, 4, 12, 10, 18);
    const stats = computeImagePixelStats(rgba);
    expect(stats.dark).toBe(true);
    expect(stats.bright).toBe(false);

    const analysis = buildImageAnalysis("night.jpg", stats);
    expect(analysis.moodSuggestion.darkness).toBeGreaterThanOrEqual(80);
    expect(analysis.visualMood).toMatch(/dark/i);
    expect(analysis.summary).toContain("night.jpg");
    expect(analysis.suggestedGenres.length).toBeGreaterThan(0);
    expect(analysis.suggestedGenres.every(isCatalogGenre)).toBe(true);
  });

  it("maps bright warm pixels to brighter mood", () => {
    const rgba = solidRgba(4, 4, 240, 200, 120);
    const analysis = analyzeImagePixelData(rgba, "sunset.png");

    expect(analysis.moodSuggestion.darkness).toBeLessThanOrEqual(30);
    expect(analysis.visualMood).toMatch(/bright/i);
    expect(analysis.visualMood).toMatch(/warm/i);
    expect(analysis.avgColor).toMatch(/^rgb\(/);
  });

  it("dedupes catalog suggestions in analysis output", () => {
    const rgba = solidRgba(2, 2, 8, 8, 40);
    const analysis = analyzeImagePixelData(rgba, "dup-test.jpg");
    const genreCount = analysis.suggestedGenres.length;
    expect(new Set(analysis.suggestedGenres).size).toBe(genreCount);
  });
});
