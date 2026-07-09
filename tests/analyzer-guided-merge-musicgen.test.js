import { describe, expect, it } from "vitest";
import { compactAudioStyleRule } from "../app/lib/analyzer-guided-merge.js";

describe("compactAudioStyleRule musicgen", () => {
  it("appends MusicGen prompt snippet for musicgen source reports", () => {
    const rule = compactAudioStyleRule({
      estimatedBpm: "128 BPM",
      energy: 60,
      aggression: 40,
      brightness: 50,
      suggestedGenres: ["Techno"],
      sourceEngine: "musicgen",
      musicGenPrompt: "dark driving techno with acid bass",
    });
    expect(rule).toMatch(/^AUDIO:/);
    expect(rule).toMatch(/MG:dark driving techno/);
  });

  it("tags highlight melody mode on MG rule line", () => {
    const rule = compactAudioStyleRule({
      estimatedBpm: "128 BPM",
      energy: 60,
      aggression: 40,
      brightness: 50,
      suggestedGenres: ["Techno"],
      sourceEngine: "musicgen",
      musicGenPrompt: "dark driving techno with acid bass",
      musicGenMode: "melody",
      musicGenHighlightMelody: true,
    });
    expect(rule).toMatch(/MG:.*·HL/);
  });
});
