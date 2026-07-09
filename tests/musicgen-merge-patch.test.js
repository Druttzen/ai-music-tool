import { describe, expect, it } from "vitest";
import { buildAudioAnalyzerPatch } from "../app/lib/analyzer-guided-merge.js";

function applyPatch(state, patch) {
  const next = { ...state };
  for (const [key, value] of Object.entries(patch)) {
    next[key] = typeof value === "function" ? value(next[key]) : value;
  }
  return next;
}

describe("buildAudioAnalyzerPatch musicgen merge", () => {
  it("merges MG prompt line into rules for musicgen source reports", () => {
    const report = {
      estimatedBpm: "128 BPM",
      energy: 62,
      aggression: 40,
      brightness: 55,
      suggestedGenres: ["Techno"],
      suggestedSounds: ["Acid bass"],
      suggestedRhythms: ["4/4"],
      sourceEngine: "musicgen",
      musicGenPrompt: "dark driving techno with acid bass",
      trackSummary: "MusicGen preview",
    };

    const base = {
      rules: "",
      selectedGenres: ["House"],
      selectedSounds: [],
      selectedRhythms: [],
      idea: "",
      notes: "",
      tempo: "120 BPM",
      mood: { darkness: 50, energy: 50, aggression: 30, emotion: 50, complexity: 50, space: 50 },
    };

    const next = applyPatch(base, buildAudioAnalyzerPatch(report, (s) => `${s}s`));
    expect(next.rules).toMatch(/^AUDIO:/);
    expect(next.rules).toMatch(/MG:dark driving techno/);
    expect(next.selectedGenres).toContain("Techno");
    expect(next.tempo).toBe("128 BPM");
  });

  it("tags highlight melody on MG merge line", () => {
    const report = {
      estimatedBpm: "128 BPM",
      energy: 62,
      aggression: 40,
      brightness: 55,
      suggestedGenres: ["Techno"],
      sourceEngine: "musicgen",
      musicGenPrompt: "dark driving techno",
      musicGenMode: "melody",
      musicGenHighlightMelody: true,
    };
    const base = {
      rules: "",
      selectedGenres: [],
      selectedSounds: [],
      selectedRhythms: [],
      idea: "",
      notes: "",
      tempo: "120 BPM",
      mood: { darkness: 50, energy: 50, aggression: 30, emotion: 50, complexity: 50, space: 50 },
    };
    const next = applyPatch(base, buildAudioAnalyzerPatch(report, (s) => `${s}s`));
    expect(next.rules).toMatch(/·HL/);
  });
});
