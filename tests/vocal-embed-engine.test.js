import { describe, expect, it, vi } from "vitest";
import { buildVocalEmbedExport, buildVocalEmbedPlan } from "../app/lib/vocal-embed-engine.js";

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

  it("switches mode when a guide vocal is attached", () => {
    const plan = buildVocalEmbedPlan({
      audioAnalysis: AUDIO,
      guideVocalAttached: true,
      vocalEmbedLyrics: "[Verse]\nGuide me",
      voiceStyleLine: "custom warm tenor",
    });
    expect(plan.stage).toBe("ready");
    expect(plan.sidecarMode).toBe("guide-vocal-conversion");
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
});
