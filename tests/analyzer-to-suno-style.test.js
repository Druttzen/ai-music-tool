import { describe, expect, it } from "vitest";
import {
  buildImageSunoV55Patch,
  buildSunoV55StyleFromImageAnalysis,
  hintsFromClipLabel,
} from "../app/lib/image-to-suno-style.js";
import {
  buildAudioSunoV55Patch,
  buildSunoV55StyleFromAudioAnalysis,
} from "../app/lib/audio-to-suno-style.js";
import {
  buildSunoStyleLlmMessages,
  parseSunoStyleLlmResponse,
} from "../app/lib/analyzer-suno-style-llm.js";

describe("image-to-suno-style", () => {
  it("maps CLIP music labels to genre/mood hints", () => {
    const h = hintsFromClipLabel("industrial techno warehouse");
    expect(h.genres).toContain("Techno");
    expect(h.mood.length).toBeGreaterThan(0);
    expect(h.production.length).toBeGreaterThan(0);
  });

  it("builds ordered Suno v5.5 style line from image report", () => {
    const built = buildSunoV55StyleFromImageAnalysis({
      visualMood: "dark, cool",
      caption: "a neon city at night",
      suggestedGenres: ["Synthwave"],
      suggestedSounds: ["Analog synths"],
      suggestedRhythms: ["4/4"],
      clipTags: [{ label: "neon cyberpunk synth night", score: 0.9 }],
      moodSuggestion: { energy: 70, darkness: 80 },
    });
    expect(built.styleLine.length).toBeGreaterThan(10);
    expect(built.styleLine.toLowerCase()).toMatch(/synth|neon|dark|analog/);
    expect(built.pillsPatch.selectedGenres.length).toBeGreaterThan(0);
    expect(built.source).toBe("heuristic");
  });

  it("buildImageSunoV55Patch activates paste Style and merges pills", () => {
    const report = {
      visualMood: "misty cyan",
      suggestedGenres: ["Ambient"],
      suggestedSounds: ["Pads"],
      suggestedRhythms: ["Minimal"],
      clipTags: [{ label: "dark ambient drone", score: 0.85 }],
    };
    const built = buildSunoV55StyleFromImageAnalysis(report);
    const patch = buildImageSunoV55Patch(report, built);
    expect(patch.sunoPasteStyle).toBe(built.styleLine);
    expect(patch.sunoPasteActive).toBeUndefined();
    expect(patch.selectedGenres([])).toContain("Ambient");
    expect(patch.idea("")).toContain("Inspired by image");
  });
});

describe("audio-to-suno-style", () => {
  it("builds style line from audio DNA", () => {
    const built = buildSunoV55StyleFromAudioAnalysis({
      estimatedBpm: "128 BPM",
      estimatedKey: "Am",
      energy: 80,
      aggression: 60,
      suggestedGenres: ["Techno"],
      suggestedSubgenres: ["Industrial"],
      suggestedSounds: ["Heavy sub bass"],
      suggestedRhythms: ["4/4"],
      suggestedMoods: ["dark", "driving"],
      vocals: "Instrumental",
      trackSummary: "Warehouse pressure",
    });
    expect(built.styleLine).toMatch(/Techno|128|sub/i);
    expect(built.pillsPatch.tempo).toBe("128 BPM");
    expect(built.negativeHints).toMatch(/vocal/i);
  });

  it("buildAudioSunoV55Patch sets paste Style", () => {
    const report = {
      estimatedBpm: "100 BPM",
      suggestedGenres: ["Ambient"],
      suggestedSounds: ["Pads"],
      suggestedRhythms: ["Slow pulse"],
      trackSummary: "Soft pads",
      highlightStart: 0,
      highlightEnd: 10,
    };
    const built = buildSunoV55StyleFromAudioAnalysis(report);
    const patch = buildAudioSunoV55Patch(report, (s) => `${s}s`, built);
    expect(patch.sunoPasteStyle).toBeTruthy();
    expect(patch.sunoPasteActive).toBeUndefined();
    expect(patch.tempo).toBe("100 BPM");
  });
});

describe("analyzer-suno-style-llm", () => {
  it("builds LLM messages for image refine", () => {
    const { system, user } = buildSunoStyleLlmMessages(
      "image",
      { styleLine: "Ambient, dark" },
      { caption: "forest at dusk", clipTags: [{ label: "dark ambient drone", score: 0.8 }] },
    );
    expect(system).toMatch(/Suno v5\.5/);
    expect(user).toContain("forest at dusk");
    expect(user).toContain("Ambient, dark");
  });

  it("parses JSON style LLM response", () => {
    const parsed = parseSunoStyleLlmResponse(
      'Here you go:\n{"styleLine":"Techno, dark, metallic percussion, warehouse","negativeHints":"no acoustic guitar","lyricThemeHint":"night drive"}',
    );
    expect(parsed.styleLine).toContain("Techno");
    expect(parsed.negativeHints).toContain("acoustic");
  });
});
