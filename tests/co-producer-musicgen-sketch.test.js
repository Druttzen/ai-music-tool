import { describe, expect, it } from "vitest";
import {
  appendMusicGenSketchToReport,
  buildCoProducerAdvisoryReport,
  formatMusicGenSketchBrief,
} from "../app/lib/co-producer-engine.js";

describe("formatMusicGenSketchBrief", () => {
  it("extracts musicgen analyzer metadata", () => {
    const sketch = formatMusicGenSketchBrief({
      sourceEngine: "musicgen",
      musicGenPrompt: "dark techno loop",
      estimatedBpm: "128 BPM",
      estimatedKey: "Am",
      musicGenMode: "melody",
    });
    expect(sketch?.prompt).toBe("dark techno loop");
    expect(sketch?.mode).toBe("melody");
  });
});

describe("buildCoProducerAdvisoryReport musicgen sketch", () => {
  it("references loaded MusicGen sketch in the report", () => {
    const { output } = buildCoProducerAdvisoryReport({
      selectedGenres: ["Techno"],
      selectedSounds: ["Acid bass"],
      selectedRhythms: ["4/4"],
      mood: { darkness: 60, energy: 70, aggression: 40, emotion: 50, complexity: 50, space: 40 },
      moodWords: "driving",
      tempo: "128 BPM",
      vocal: "Instrumental",
      lyricTheme: "",
      promptIntensity: 50,
      mode: "Hybrid",
      musicGenAvailable: true,
      audioAnalysis: {
        sourceEngine: "musicgen",
        musicGenPrompt: "dark driving techno",
        estimatedBpm: "128 BPM",
        estimatedKey: "Am",
      },
    });
    expect(output).toMatch(/Local MusicGen sketch/i);
    expect(output).toMatch(/dark driving techno/);
  });
});

describe("appendMusicGenSketchToReport", () => {
  it("does not duplicate sketch lines", () => {
    const once = appendMusicGenSketchToReport("CO-PRODUCER AI REPORT\nok", {
      prompt: "loop",
      bpm: "120 BPM",
      key: "C",
    });
    const twice = appendMusicGenSketchToReport(once, {
      prompt: "loop",
      bpm: "120 BPM",
      key: "C",
    });
    expect(twice).toBe(once);
  });
});
