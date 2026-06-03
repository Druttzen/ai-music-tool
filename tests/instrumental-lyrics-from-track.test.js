import { describe, it, expect } from "vitest";
import {
  buildInstrumentalLyricsScaffold,
  buildLyricThemeFromAnalysis,
  inferStructureFromTrack,
  isLikelyInstrumentalTrack,
  stripInstrumentalOnlyRules,
  suggestVocalRoleFromAnalysis,
} from "../app/lib/instrumental-lyrics-from-track.js";

describe("instrumental-lyrics-from-track", () => {
  const analysis = {
    fileName: "beat.wav",
    duration: 210,
    bpm: 128,
    estimatedBpm: "128 BPM",
    trackSummary: "Dark rolling techno with metallic percussion",
    suggestedGenres: ["Techno"],
    suggestedMoods: ["Dark", "Driving"],
    vocals: "Instrumental likely",
    highlightLabel: "Drop",
    highlightStart: 64,
    highlightEnd: 96,
    energy: 72,
    aggression: 55,
  };

  it("detects instrumental uploads", () => {
    expect(isLikelyInstrumentalTrack(analysis, "Instrumental")).toBe(true);
    expect(isLikelyInstrumentalTrack({ vocals: "Vocals likely" }, "Female Lead")).toBe(false);
  });

  it("builds theme and structure from analysis", () => {
    expect(buildLyricThemeFromAnalysis(analysis)).toContain("techno");
    expect(inferStructureFromTrack(analysis)).toContain("drop");
  });

  it("scaffold includes timed sections and highlight hook", () => {
    const text = buildInstrumentalLyricsScaffold(analysis);
    expect(text).toContain("[Verse 1");
    expect(text).toContain("[Chorus");
    expect(text).toContain("Drop");
    expect(text).toContain("1:04");
  });

  it("strips instrumental-only rules", () => {
    const out = stripInstrumentalOnlyRules("keep this\nno vocals, no vocal chops\nno mumbled speech");
    expect(out).toBe("keep this");
  });

  it("suggests vocal role from energy", () => {
    expect(suggestVocalRoleFromAnalysis({ energy: 80, aggression: 40 })).toBe("Male Lead");
    expect(suggestVocalRoleFromAnalysis({ energy: 30, aggression: 30 })).toBe("Female Lead");
  });
});
