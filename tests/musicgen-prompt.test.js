import { describe, expect, it } from "vitest";
import { buildMusicGenPrompt } from "../app/lib/musicgen-prompt.js";

describe("buildMusicGenPrompt", () => {
  it("prefers a trimmed custom prompt", () => {
    expect(buildMusicGenPrompt({ customPrompt: "  dark techno loop  " })).toBe("dark techno loop");
  });

  it("builds from project fields and caps length", () => {
    const prompt = buildMusicGenPrompt({
      selectedGenres: ["Techno", "Industrial"],
      tempo: "128 BPM",
      moodWords: "dark, driving, hypnotic",
      selectedSounds: ["acid bass", "909 hats"],
      idea: "warehouse night drive",
    });
    expect(prompt).toContain("Techno + Industrial");
    expect(prompt).toContain("128 bpm");
    expect(prompt).toContain("dark, driving, hypnotic");
    expect(prompt.length).toBeLessThanOrEqual(480);
  });

  it("falls back to analyzer summary when project fields are sparse", () => {
    const prompt = buildMusicGenPrompt({
      audioAnalysis: {
        trackSummary: "Mid-tempo funk groove with warm Rhodes and tight drums",
        estimatedBpm: "98 BPM",
        estimatedKey: "E minor",
      },
    });
    expect(prompt).toContain("Mid-tempo funk groove");
  });

  it("returns empty prompt on blank slate", () => {
    expect(buildMusicGenPrompt({})).toBe("");
    expect(buildMusicGenPrompt({ moodWords: "balanced" })).toBe("");
  });

  it("uses default instrumental prompt when only neutral mood is set but analysis exists", () => {
    expect(
      buildMusicGenPrompt({
        audioAnalysis: { estimatedBpm: "120 BPM", estimatedKey: "C major" },
      }),
    ).toContain("120 BPM");
  });
});
