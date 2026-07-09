import { describe, expect, it } from "vitest";
import { buildCoProducerAdvisoryReport } from "../app/lib/co-producer-engine.js";

describe("buildCoProducerAdvisoryReport musicgen", () => {
  it("suggests MusicGen sketch when identity is thin and sidecar is available", () => {
    const { output } = buildCoProducerAdvisoryReport({
      selectedGenres: ["Electronic"],
      selectedSounds: [],
      selectedRhythms: [],
      mood: { darkness: 40, energy: 50, aggression: 30, emotion: 50, complexity: 40, space: 40 },
      moodWords: "neutral",
      tempo: "120 BPM",
      vocal: "Instrumental",
      lyricTheme: "",
      promptIntensity: 50,
      mode: "Hybrid",
      musicGenAvailable: true,
    });
    expect(output).toMatch(/MusicGen sketch/i);
  });
});
