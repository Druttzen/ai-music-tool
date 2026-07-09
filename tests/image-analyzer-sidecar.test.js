/** Tests for image sidecar merge helpers. */

import { describe, expect, it } from "vitest";
import {
  mapImageCaptionToSuno,
  mapClipTagsToSuno,
  mergeSidecarImageAnalysis,
} from "../app/lib/image-analyzer-sidecar.js";

describe("image-analyzer-sidecar", () => {
  const pixelReport = {
    fileName: "cover.jpg",
    avgColor: "rgb(10, 20, 30)",
    brightness: 120,
    saturation: 40,
    contrast: 30,
    visualMood: "dark, muted, soft-contrast, cool",
    suggestedGenres: ["Ambient"],
    suggestedSounds: ["Analog synths, atmospheric textures"],
    suggestedRhythms: ["Minimal"],
    summary: "File: cover.jpg",
    moodSuggestion: { energy: 45 },
  };

  it("maps caption keywords to catalog genres", () => {
    const mapped = mapImageCaptionToSuno("a dark synthwave cityscape at night");
    expect(mapped.suggestedGenres).toContain("Synthwave");
    expect(mapped.suggestedSounds.length).toBeGreaterThan(0);
  });

  it("maps CLIP tags to catalog genres", () => {
    const mapped = mapClipTagsToSuno([
      { label: "neon cyberpunk cityscape", score: 0.9 },
      { label: "dark moody forest", score: 0.7 },
    ]);
    expect(mapped.suggestedGenres.length).toBeGreaterThan(0);
    expect(mapped.suggestedSounds.length).toBeGreaterThan(0);
  });

  it("merges BLIP caption into pixel report", () => {
    const merged = mergeSidecarImageAnalysis(pixelReport, {
      caption: "a neon cyberpunk street with rain",
      caption_model: "Salesforce/blip-image-captioning-base",
      device: "cpu",
    });
    expect(merged.analysisEngine).toBe("pixel+blip");
    expect(merged.caption).toContain("cyberpunk");
    expect(merged.suggestedGenres.length).toBeGreaterThanOrEqual(1);
    expect(merged.summary).toContain("Scene caption");
  });

  it("merges CLIP tags alongside BLIP caption", () => {
    const merged = mergeSidecarImageAnalysis(pixelReport, {
      caption: "a city at night",
      caption_model: "Salesforce/blip-image-captioning-base",
      clip_tags: [{ label: "neon cyberpunk cityscape", score: 0.88 }],
      clip_model: "openai/clip-vit-base-patch32",
      device: "cpu",
    });
    expect(merged.analysisEngine).toContain("clip");
    expect(merged.summary).toContain("Visual tags");
    expect(merged.suggestedGenres.length).toBeGreaterThanOrEqual(1);
  });
});
