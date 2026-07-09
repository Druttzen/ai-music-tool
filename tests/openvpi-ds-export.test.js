import { describe, expect, it } from "vitest";
import { buildOpenvpiDsExport, buildOpenvpiDsSegmentsFromPlan, tryBuildOpenvpiDsForWorkspace } from "../app/lib/openvpi-ds-export.js";
import { buildVocalEmbedPlan } from "../app/lib/vocal-embed-engine.js";

const AUDIO = {
  fileName: "beat.wav",
  duration: 120,
  estimatedBpm: "128 BPM",
  estimatedKey: "Am",
};

describe("openvpi-ds-export", () => {
  it("builds DS segments from vocal embed plan sections", () => {
    const plan = buildVocalEmbedPlan({
      audioAnalysis: AUDIO,
      generatedLyrics: "[Verse]\nhello world again\n\n[Chorus]\nshine bright tonight",
      lyricStructure: "verse -> chorus",
      voiceStyleLine: "warm baritone",
    });

    const segments = buildOpenvpiDsSegmentsFromPlan(plan);
    expect(segments.length).toBeGreaterThanOrEqual(2);
    expect(segments[0]).toMatchObject({
      offset: expect.any(Number),
      text: expect.any(String),
      note_seq: expect.any(String),
      note_dur: expect.any(String),
    });
    expect(segments[0].text.split(" ").length).toBe(segments[0].note_seq.split(" ").length);
  });

  it("uses aligned word timing when present", () => {
    const plan = buildVocalEmbedPlan({
      audioAnalysis: AUDIO,
      generatedLyrics: "[Verse]\nline one",
      voiceStyleLine: "warm baritone",
    });
    const payload = buildOpenvpiDsExport(plan, {
      align_method: "heuristic",
      sections: [{ alignedWords: [{ word: "line", start: 1, end: 1.4 }, { word: "one", start: 1.4, end: 1.9 }] }],
    });
    expect(payload.segment_count).toBeGreaterThan(0);
    expect(payload.align_method).toBe("heuristic");
    expect(payload.segments[0].note_dur).toContain("0.4000");
  });

  it("tryBuildOpenvpiDsForWorkspace returns null when plan is draft", () => {
    expect(tryBuildOpenvpiDsForWorkspace({ generatedLyrics: "" }, null)).toBeNull();
  });
});
