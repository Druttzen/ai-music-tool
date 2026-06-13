import { describe, it, expect } from "vitest";
import {
  buildCoProducerAdvisoryReport,
  buildCoProducerQuickTweakPatch,
} from "../app/lib/co-producer-engine.js";

describe("co-producer-engine", () => {
  it("buildCoProducerQuickTweakPatch darkens mood", () => {
    const patch = buildCoProducerQuickTweakPatch("Make darker");
    expect(typeof patch.mood).toBe("function");
    expect(patch.mood({ darkness: 40, energy: 50, aggression: 30, complexity: 50, emotion: 50, space: 50 }).darkness).toBe(55);
  });

  it("buildCoProducerQuickTweakPatch adds cinematic genres and sounds", () => {
    const patch = buildCoProducerQuickTweakPatch("More cinematic");
    expect(patch.selectedGenres(["Techno"])).toContain("Cinematic");
    expect(patch.selectedSounds(["Heavy sub bass"])).toContain("Orchestral strings");
  });

  it("buildCoProducerAdvisoryReport suggests fixes for crowded genres", () => {
    const { output, patch } = buildCoProducerAdvisoryReport({
      selectedGenres: ["Techno", "House", "Trance", "Drum and Bass"],
      selectedSounds: ["Heavy sub bass"],
      selectedRhythms: ["4/4"],
      mood: { energy: 50, darkness: 40, aggression: 30, complexity: 50, emotion: 50, space: 50 },
      moodWords: "balanced",
      tempo: "128 BPM",
      vocal: "Lead Vocal",
      lyricTheme: "long enough theme here",
      promptIntensity: 40,
      mode: "Hybrid",
    });
    expect(output).toContain("CO-PRODUCER AI REPORT");
    expect(output).toMatch(/Too many genres/i);
    expect(patch).toEqual({});
  });

  it("buildCoProducerAdvisoryReport auto-adds sound fixes for dark aggressive mood", () => {
    const { patch } = buildCoProducerAdvisoryReport({
      selectedGenres: ["Techno"],
      selectedSounds: [],
      selectedRhythms: [],
      mood: { energy: 50, darkness: 80, aggression: 80, complexity: 50, emotion: 50, space: 80 },
      moodWords: "dark, aggressive",
      tempo: "140 BPM",
      vocal: "Lead Vocal",
      lyricTheme: "enough theme text",
      promptIntensity: 40,
      mode: "Hybrid",
    });
    expect(typeof patch.selectedSounds).toBe("function");
    const sounds = patch.selectedSounds([]);
    expect(sounds).toContain("Dark pads");
    expect(sounds).toContain("Distorted bass");
    expect(sounds).toContain("Dub delays");
  });
});
