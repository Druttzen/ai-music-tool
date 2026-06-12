import { describe, it, expect } from "vitest";
import {
  buildAudioAnalyzerSuggestions,
  buildImagePaletteSuggestions,
  resolveCatalogLabel,
  resolveCatalogTags,
  isCatalogGenre,
} from "../app/lib/analyzer-suggestions.js";
import { genreOptions, soundOptions } from "../app/lib/suno-music-styles.js";

describe("analyzer-suggestions", () => {
  it("resolves tags to catalog labels", () => {
    expect(resolveCatalogLabel("techno", genreOptions)).toBe("Techno");
    expect(resolveCatalogLabel("808 bass", soundOptions)).toBe("808 bass");
    expect(resolveCatalogTags(["Techno", "fake genre"], genreOptions)).toEqual(["Techno"]);
  });

  it("suggests catalog genres for high-energy audio", () => {
    const out = buildAudioAnalyzerSuggestions({
      energy: 80,
      aggression: 75,
      brightness: 50,
      darkness: 40,
      complexity: 45,
      bpm: 130,
      centroidHz: 2000,
    });
    expect(out.suggestedGenres.length).toBeGreaterThan(0);
    expect(out.suggestedGenres.every(isCatalogGenre)).toBe(true);
    expect(out.suggestedSounds.length).toBeGreaterThan(0);
  });

  it("suggests DnB-friendly tags for fast BPM", () => {
    const out = buildAudioAnalyzerSuggestions({
      energy: 70,
      aggression: 60,
      brightness: 55,
      darkness: 45,
      complexity: 50,
      bpm: 174,
      centroidHz: 1800,
    });
    expect(out.suggestedGenres).toContain("Drum & Bass");
  });

  it("maps vivid warm image palette to catalog genres", () => {
    const out = buildImagePaletteSuggestions({
      dark: false,
      cool: false,
      warm: true,
      vivid: true,
      bright: true,
      highContrast: false,
    });
    expect(out.suggestedGenres.some((g) => ["House", "Pop", "Reggaeton", "Funk"].includes(g))).toBe(true);
  });
});
