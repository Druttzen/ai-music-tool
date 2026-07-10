import { describe, expect, it } from "vitest";
import { analyzeSunoPromptQuality } from "../app/lib/suno-prompt-critic.js";
import { buildConfidenceScores, fuseStyleDnaWithSonicLayers } from "../app/lib/sonic-signature-fusion.js";
import { buildCustomModelPack } from "../app/lib/custom-model-pack.js";
import { buildUdioProsePrompt } from "../app/lib/udio-prose-export.js";
import { generateSunoMetatagScaffold } from "../app/lib/suno-metatag-generator.js";
import { buildVoicesPrepKit } from "../app/lib/voices-prep-kit.js";
import { fixSunoPronunciation } from "../app/lib/pronunciation-engine.js";
import { buildAlbumSequence, soundBibleFromProject } from "../app/lib/album-mode.js";

describe("suno-prompt-critic", () => {
  it("scores detailed style higher than empty", () => {
    const weak = analyzeSunoPromptQuality("");
    const strong = analyzeSunoPromptQuality(
      "synth-pop, 118 BPM, polished lead vocal, emotive phrasing, bright leads, studio close-mic",
      "[Verse]\nhello\n[Chorus]\nworld",
    );
    expect(strong.score).toBeGreaterThan(weak.score);
  });

  it("flags conflicting tags", () => {
    const out = analyzeSunoPromptQuality("calm ambient, aggressive distorted metal");
    expect(out.issues.some((i) => i.message.includes("Conflicting"))).toBe(true);
  });
});

describe("sonic-signature-fusion", () => {
  it("prefers audio BPM and key over metadata", () => {
    const { dna, confidence } = fuseStyleDnaWithSonicLayers(
      { genres: ["Pop"], tempo: "100 BPM", estimatedKey: "C major" },
      { tempo_bpm: 128, key_estimate: "F minor", key_confidence: 0.8, chord_progression: [{ chord: "Fm" }] },
      null,
      null,
    );
    expect(dna.tempo).toBe("128 BPM");
    expect(dna.estimatedKey).toBe("F minor");
    expect(confidence.bpm.source).toBe("audio");
  });

  it("buildConfidenceScores returns levels", () => {
    const c = buildConfidenceScores({ genres: ["Rock"] }, { tempo_bpm: 120, key_confidence: 0.7 }, null, null);
    expect(c.bpm.level).toBe("high");
  });
});

describe("suno 5.5 pro addons", () => {
  it("custom model pack requires 6 tracks", () => {
    const pack = buildCustomModelPack(
      Array.from({ length: 5 }, (_, i) => ({ title: `T${i}`, genres: ["pop"], bpm: "120 BPM" })),
    );
    expect(pack.ready).toBe(false);
  });

  it("udio prose is paragraph not comma tags", () => {
    const prose = buildUdioProsePrompt({
      genres: ["Jazz"],
      tempo: "95 BPM",
      sounds: ["piano", "brushed drums"],
      vocalRole: "Female Lead",
    });
    expect(prose).toMatch(/Jazz/);
    expect(prose.length).toBeGreaterThan(40);
  });

  it("metatag scaffold includes Verse and Chorus", () => {
    const scaffold = generateSunoMetatagScaffold({ structure: "verse → chorus" });
    expect(scaffold).toMatch(/\[Verse/);
    expect(scaffold).toMatch(/\[Chorus/);
  });

  it("voices prep kit checks duration", () => {
    const kit = buildVoicesPrepKit({ pitchRangeSemitones: 10, pitchMedianHz: 220 }, 20);
    expect(kit.checks.some((c) => c.label === "Sample length" && c.ok)).toBe(true);
  });

  it("pronunciation engine fixes queue", () => {
    const { lyrics, changed } = fixSunoPronunciation("waiting in the queue");
    expect(changed).toBe(true);
    expect(lyrics).toContain("cue");
  });

  it("album mode builds cohesive sequence", () => {
    const tracks = buildAlbumSequence(
      { genres: ["Pop"], tempo: "118 BPM", vocal: "Female Lead" },
      [{ title: "Open", role: "opener" }, { title: "Hit", role: "single" }],
    );
    expect(tracks).toHaveLength(2);
    expect(tracks[0].styleLine).toContain("album");
  });

  it("album mode includes per-track idea and analyzer key in style line", () => {
    const bible = soundBibleFromProject({
      selectedGenres: ["Pop"],
      tempo: "118 BPM",
      vocal: "Female Lead",
      audioAnalysis: { estimatedKey: "C major" },
    });
    expect(bible.key).toBe("C major");

    const tracks = buildAlbumSequence(bible, [
      { title: "Open", role: "opener", idea: "sunrise over the city" },
    ]);
    expect(tracks[0].styleLine).toContain("sunrise over the city");
    expect(tracks[0].styleLine).toContain("C major");
  });
});
