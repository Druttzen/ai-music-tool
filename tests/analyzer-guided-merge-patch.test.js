import { describe, it, expect } from "vitest";
import {
  buildAudioAnalyzerPatch,
  buildImageAnalyzerPatch,
  mergeAudioHighlightIntoIdea,
} from "../app/lib/analyzer-guided-merge.js";

describe("analyzer merge patches", () => {
  it("buildAudioAnalyzerPatch merges genres and sounds", () => {
    const patch = buildAudioAnalyzerPatch(
      {
        estimatedBpm: "128 BPM",
        suggestedGenres: ["Techno"],
        suggestedSubgenres: ["Industrial"],
        suggestedSounds: ["Sub bass"],
        suggestedInstruments: ["Analog synths"],
        suggestedRhythms: ["4/4"],
        trackSummary: "Driving warehouse energy",
        highlightStart: 30,
        highlightEnd: 60,
        highlightLabel: "drop",
      },
      (s) => `${s}s`,
    );

    expect(patch.tempo).toBe("128 BPM");
    expect(patch.selectedGenres([])).toEqual(["Techno", "Industrial"]);
    expect(patch.selectedSounds([])).toEqual(["Sub bass", "Analog synths"]);
    expect(patch.selectedRhythms([])).toEqual(["4/4"]);
    expect(patch.idea("")).toContain("Reference track");
  });

  it("mergeAudioHighlightIntoIdea avoids duplicate reference lines", () => {
    const idea = mergeAudioHighlightIntoIdea(
      "Reference track (highlight 0:30–1:00): already there",
      { trackSummary: "x", highlightStart: 0, highlightEnd: 1 },
      () => "0:00",
    );
    expect(idea).toContain("already there");
    expect(idea.match(/Reference track/g)?.length).toBe(1);
  });

  it("buildImageAnalyzerPatch merges image genres and idea", () => {
    const patch = buildImageAnalyzerPatch({
      suggestedGenres: ["Ambient"],
      suggestedSounds: ["Pads"],
      suggestedRhythms: ["Slow pulse"],
      visualMood: "misty cyan horizon",
    });
    expect(patch.selectedGenres([])).toEqual(["Ambient"]);
    expect(patch.idea("")).toBe("Inspired by image: misty cyan horizon");
  });
});
