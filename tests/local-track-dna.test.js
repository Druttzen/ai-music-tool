import { describe, expect, it } from "vitest";
import {
  buildLocalTrackDna,
  resolveLocalCoverDurationSec,
  resolveLocalCoverRemixEngine,
} from "../app/lib/local-track-dna.js";

describe("local-track-dna", () => {
  const analysis = {
    fileName: "demo.wav",
    estimatedBpm: 128.4,
    estimatedKey: "Am",
    duration: 95.2,
    suggestedGenres: ["techno", "industrial"],
    suggestedMoods: ["dark"],
    suggestedSounds: ["synth bass"],
    suggestedRhythms: ["four-on-the-floor"],
    vocals: "Processed vocals",
    energy: 80,
  };

  it("builds DNA prompt with bpm/key from analyzer report", () => {
    const dna = buildLocalTrackDna(analysis);
    expect(dna.bpm).toBe(128);
    expect(dna.keyScale).toBe("Am");
    expect(dna.durationSec).toBe(95.2);
    expect(dna.fileName).toBe("demo.wav");
    expect(dna.prompt).toMatch(/local cover remake/);
    expect(dna.prompt).toMatch(/128 BPM/);
    expect(dna.prompt).toMatch(/key Am/);
    expect(dna.styleLine.length).toBeGreaterThan(0);
  });

  it("resolves cover engine preferring ACE then MusicGen", () => {
    expect(resolveLocalCoverRemixEngine("cover", { acestep_available: true }).engine).toBe(
      "acestep",
    );
    expect(
      resolveLocalCoverRemixEngine("cover", {
        acestep_available: false,
        generate_available: true,
      }).engine,
    ).toBe("musicgen-melody");
    expect(resolveLocalCoverRemixEngine("cover", {}).engine).toBeNull();
  });

  it("resolves remix engine from vocal-transform", () => {
    expect(
      resolveLocalCoverRemixEngine("remix", { vocal_transform_available: true }).engine,
    ).toBe("vocal-transform");
    expect(resolveLocalCoverRemixEngine("remix", {}).engine).toBeNull();
  });

  it("clamps duration per engine", () => {
    expect(resolveLocalCoverDurationSec("musicgen-melody", 40, 90)).toBe(30);
    expect(resolveLocalCoverDurationSec("musicgen-melody", null, 20)).toBe(20);
    expect(resolveLocalCoverDurationSec("acestep", 5, 120)).toBe(10);
    expect(resolveLocalCoverDurationSec("acestep", null, 90)).toBe(90);
    expect(resolveLocalCoverDurationSec("vocal-transform", 30, 90)).toBeNull();
  });
});
