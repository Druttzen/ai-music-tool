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

  it("keeps MG: when AUDIO core would otherwise fill the rule budget", () => {
    const rule = compactAudioStyleRule({
      estimatedBpm: "129 BPM",
      energy: 100,
      aggression: 95,
      brightness: 99,
      darkness: 21,
      complexity: 100,
      estimatedKey: "F# major",
      chordProgression: ["C", "G", "Am", "F"],
      suggestedGenres: ["Pop", "Indie Pop"],
      suggestedRhythms: ["4/4", "Rolling", "Syncopated", "Halftime"],
      suggestedSounds: [
        "Harmonic bed",
        "Airy high-end sheen",
        "Heavy sub bass",
        "Analog synths",
        "Side-chain pump",
        "Big drums",
        "Metallic percussion",
        "Wide stereo pads",
      ],
      sourceEngine: "musicgen",
      musicGenPrompt: "dark underground bass track with mechanical energy",
      musicGenMode: "text",
    });
    expect(rule).toMatch(/MG:dark underground bass/);
    expect(rule.length).toBeLessThanOrEqual(260);
  });

  it("includes sonic chord progression in AUDIO rule line", () => {
    const rule = compactAudioStyleRule({
      estimatedBpm: "128 BPM",
      energy: 60,
      aggression: 40,
      brightness: 50,
      estimatedKey: "F minor",
      chordProgression: ["Fm", "Bb", "C"],
      suggestedGenres: ["Pop"],
    });
    expect(rule).toMatch(/CH:Fm→Bb→C/);
  });
});
