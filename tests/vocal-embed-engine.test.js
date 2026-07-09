import { describe, expect, it, vi } from "vitest";
import {
  buildVocalEmbedExport,
  buildVocalEmbedExportEnvelope,
  buildVocalEmbedPlan,
  mergeAlignPreviewIntoPlan,
} from "../app/lib/vocal-embed-engine.js";

const AUDIO = {
  fileName: "suno-instrumental.wav",
  duration: 180,
  estimatedBpm: "128 BPM",
  estimatedKey: "A minor",
};

describe("vocal-embed-engine", () => {
  it("builds a ready local vocal embed plan from instrumental, lyrics, and voice style", () => {
    const plan = buildVocalEmbedPlan({
      audioAnalysis: AUDIO,
      generatedLyrics: "[Verse]\nLine one\nLine two\n\n[Chorus]\nHook line",
      lyricStructure: "verse -> chorus",
      selectedGenres: ["Techno"],
      voiceStyleCompact: {
        style: "mimic vocal style traits of Night narrator, baritone register",
        lyricTag: "[Vocal character: Night narrator]",
      },
    });

    expect(plan.stage).toBe("ready");
    expect(plan.warnings).toEqual([]);
    expect(plan.sections).toHaveLength(2);
    expect(plan.sections[0].lineCount).toBe(2);
    expect(plan.sidecarMode).toBe("lyrics-to-vocal-synthesis");
    expect(plan.sidecarBrief).toContain("suno-instrumental.wav");
    expect(plan.sidecarBrief).toContain("Voice style: mimic vocal style traits");
    expect(plan.mixPlan.instrumentalDuckDb).toBeLessThan(0);
  });

  it("uses lyrics synth with guide timing when guide and lyrics are present", () => {
    const plan = buildVocalEmbedPlan({
      audioAnalysis: AUDIO,
      guideVocalAttached: true,
      vocalEmbedLyrics: "[Verse]\nGuide me",
      voiceStyleLine: "custom warm tenor",
    });
    expect(plan.stage).toBe("ready");
    expect(plan.sidecarMode).toBe("lyrics-to-vocal-synthesis");
    expect(plan.guideForLyricTiming).toBe(true);
    expect(plan.sidecarBrief).toContain("Guide vocal: refines lyric word timing");
  });

  it("can convert guide vocal instead of lyric timing synthesis", () => {
    const plan = buildVocalEmbedPlan({
      audioAnalysis: AUDIO,
      guideVocalAttached: true,
      guideForLyricTiming: false,
      vocalEmbedLyrics: "[Verse]\nGuide me",
      voiceStyleLine: "custom warm tenor",
    });
    expect(plan.sidecarMode).toBe("guide-vocal-conversion");
    expect(plan.guideForLyricTiming).toBe(false);
  });

  it("reports missing pieces in draft mode", () => {
    const plan = buildVocalEmbedPlan({});
    expect(plan.stage).toBe("draft");
    expect(plan.warnings).toContain("Add or analyze the existing instrumental track first.");
    expect(plan.warnings).toContain("Add lyrics or generate a lyric draft.");
    expect(plan.warnings).toContain("Analyze or load a Voice Character preset for custom vocal style.");
  });

  it("exports a stable plan envelope", () => {
    vi.setSystemTime(new Date("2026-07-09T00:00:00Z"));
    const envelope = buildVocalEmbedExport(buildVocalEmbedPlan({ audioAnalysis: AUDIO }));
    expect(envelope.kind).toBe("vocal_embed_plan");
    expect(envelope.version).toBe(1);
    expect(envelope.createdAt).toBe("2026-07-09T00:00:00.000Z");
    expect(envelope.plan.bpm).toBe("128 BPM");
    vi.useRealTimers();
  });

  it("merges align preview words into export envelope sections", () => {
    const plan = buildVocalEmbedPlan({
      audioAnalysis: AUDIO,
      generatedLyrics: "[Verse]\nOne\n\n[Chorus]\nHook",
      voiceStyleLine: "warm tenor",
    });
    const merged = mergeAlignPreviewIntoPlan(plan, {
      align_method: "heuristic",
      word_count: 2,
      sections: [{ alignedWords: [{ word: "one", start: 0, end: 0.5 }] }, { alignedWords: [] }],
    });
    expect(merged.sections[0].alignedWords).toHaveLength(1);
    expect(merged.alignMethod).toBe("heuristic");
    const envelope = buildVocalEmbedExportEnvelope(plan, {
      align_method: "heuristic",
      sections: [{ alignedWords: [{ word: "hook", start: 1, end: 1.2 }] }],
    });
    expect(envelope.plan.sections[0].alignedWords?.[0]?.word).toBe("hook");
    const withDs = buildVocalEmbedExportEnvelope(plan, null, {
      format: "openvpi-ds-segments",
      segment_count: 1,
      segments: [{ text: "hook" }],
    });
    expect(withDs.openvpiDs?.segment_count).toBe(1);
  });
});
