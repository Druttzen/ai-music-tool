import { describe, it, expect } from "vitest";
import { buildUsableAnalyzerStylePrompt } from "../app/lib/analyzer-guided-merge.js";

describe("buildUsableAnalyzerStylePrompt", () => {
  it("returns comma-separated style tokens without file metadata", () => {
    const out = buildUsableAnalyzerStylePrompt(
      {
        suggestedGenres: ["Techno"],
        suggestedSubgenres: ["Industrial"],
        estimatedBpm: "128 BPM",
        suggestedMoods: ["dark"],
        suggestedSounds: ["Heavy sub bass"],
        suggestedInstruments: ["Analog synths"],
        suggestedRhythms: ["4/4"],
        vocals: "instrumental",
      },
      {
        suggestedGenres: ["Cinematic"],
        visualMood: "neon night",
        suggestedSounds: ["Bright leads"],
        suggestedRhythms: ["Halftime"],
      },
    );
    expect(out).toContain("Techno");
    expect(out).toContain("128 BPM");
    expect(out).toContain("neon night");
    expect(out).not.toContain("File:");
    expect(out).not.toContain("Music direction");
    expect(out).not.toContain("AUDIO STYLE");
  });
});
