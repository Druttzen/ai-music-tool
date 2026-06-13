import { describe, it, expect } from "vitest";
import {
  buildCharacterLabel,
  estimateF0Hz,
  registerFromPitchHz,
  suggestVocalRoleFromTraits,
} from "../app/lib/voice-character-analyzer.js";
import {
  buildSunoLinesFromVoiceCharacter,
  createCharacterVoicePreset,
  attachCharacterVoicePresetsToProjectExport,
  extractCharacterVoicePresetsFromProject,
  mergeCharacterPresetsMaps,
  parseCharacterPresetsImport,
  regenerateCharacterVoicePreset,
  serializeCharacterPresetsExport,
} from "../app/lib/voice-character-preset.js";
import { parseYoutubeReference } from "../app/lib/youtube-reference.js";

describe("voice-character-analyzer", () => {
  it("estimateF0Hz finds low tone near 120 Hz", () => {
    const sampleRate = 44100;
    const slice = new Float32Array(sampleRate / 10);
    for (let i = 0; i < slice.length; i++) {
      slice[i] = Math.sin((2 * Math.PI * 120 * i) / sampleRate) * 0.4;
    }
    const f0 = estimateF0Hz(slice, sampleRate);
    expect(f0).toBeGreaterThan(100);
    expect(f0).toBeLessThan(145);
  });

  it("registerFromPitchHz maps median pitch to register band", () => {
    expect(registerFromPitchHz(175).id).toBe("baritone");
    expect(registerFromPitchHz(280).id).toBe("alto");
  });

  it("suggestVocalRoleFromTraits picks lead roles from register", () => {
    expect(suggestVocalRoleFromTraits("baritone", 40, 40)).toBe("Male Lead");
    expect(suggestVocalRoleFromTraits("soprano", 40, 70)).toBe("Female Lead");
  });

  it("buildCharacterLabel composes readable label", () => {
    expect(buildCharacterLabel("tenor register", ["breathy", "close-mic"], "moderate phrasing")).toContain(
      "tenor register",
    );
  });
});

describe("voice-character-preset", () => {
  const analysis = {
    characterLabel: "baritone register, breathy, moderate phrasing",
    registerLabel: "baritone register",
    pitchMedianHz: 180,
    textureTags: ["breathy", "steady pitch"],
    deliveryPace: "moderate phrasing",
    suggestedVocalRole: "Male Lead",
  };

  it("buildSunoLinesFromVoiceCharacter produces Style and vocal role", () => {
    const lines = buildSunoLinesFromVoiceCharacter(analysis, {
      characterName: "Night narrator",
      selectedGenres: ["Techno"],
    });
    expect(lines.voiceStyleLine).toMatch(/trait map/i);
    expect(lines.voiceStyleLine).toContain("Night narrator");
    expect(lines.vocalRole).toBe("Male Lead");
    expect(lines.voiceStyleCompact.lyricTag).toContain("[Vocal character:");
  });

  it("regenerateCharacterVoicePreset refreshes lines with new genres", () => {
    const preset = createCharacterVoicePreset(
      "Test",
      analysis,
      buildSunoLinesFromVoiceCharacter(analysis, { characterName: "Test" }),
    );
    const regen = regenerateCharacterVoicePreset(preset, { selectedGenres: ["House"] });
    expect(regen?.voiceStyleLine).toContain("House");
  });

  it("parseCharacterPresetsImport accepts export envelope and bare map", () => {
    const preset = createCharacterVoicePreset(
      "Alpha",
      analysis,
      buildSunoLinesFromVoiceCharacter(analysis, { characterName: "Alpha" }),
    );
    const envelope = serializeCharacterPresetsExport({ Alpha: preset }, "0.9.2");
    const fromEnvelope = parseCharacterPresetsImport(envelope);
    expect(fromEnvelope.Alpha.name).toBe("Alpha");

    const fromMap = parseCharacterPresetsImport({ Beta: { ...preset, name: "Beta" } });
    expect(fromMap.Beta.name).toBe("Beta");
  });

  it("mergeCharacterPresetsMaps overlays imported names", () => {
    const merged = mergeCharacterPresetsMaps(
      { Keep: { name: "Keep", analysis, voiceStyleLine: "x" } },
      { New: { name: "New", analysis, voiceStyleLine: "y" } },
    );
    expect(Object.keys(merged).sort()).toEqual(["Keep", "New"]);
  });

  it("normalizeCharacterPresetRecord coerces invalid textureTags to an array", () => {
    const preset = createCharacterVoicePreset(
      "Safe",
      { ...analysis, textureTags: "not-an-array" },
      buildSunoLinesFromVoiceCharacter(analysis, { characterName: "Safe" }),
    );
    const fromMap = parseCharacterPresetsImport({ Safe: preset });
    expect(fromMap.Safe.analysis.textureTags).toEqual([]);
  });

  it("attachCharacterVoicePresetsToProjectExport adds presets map when non-empty", () => {
    const preset = createCharacterVoicePreset(
      "Alpha",
      analysis,
      buildSunoLinesFromVoiceCharacter(analysis, { characterName: "Alpha" }),
    );
    const out = attachCharacterVoicePresetsToProjectExport({ idea: "test" }, { Alpha: preset });
    expect(out.characterVoicePresets.Alpha.name).toBe("Alpha");
    expect(attachCharacterVoicePresetsToProjectExport({ idea: "test" }, {})).toEqual({ idea: "test" });
  });

  it("extractCharacterVoicePresetsFromProject reads optional project field", () => {
    const preset = createCharacterVoicePreset(
      "Beta",
      analysis,
      buildSunoLinesFromVoiceCharacter(analysis, { characterName: "Beta" }),
    );
    expect(extractCharacterVoicePresetsFromProject({ characterVoicePresets: { Beta: preset } }).Beta.name).toBe(
      "Beta",
    );
    expect(extractCharacterVoicePresetsFromProject({ idea: "x" })).toBeNull();
  });
});

describe("youtube-reference", () => {
  it("parseYoutubeReference extracts video id", () => {
    expect(parseYoutubeReference("https://youtu.be/dQw4w9WgXcQ")?.videoId).toBe("dQw4w9WgXcQ");
    expect(parseYoutubeReference("https://www.youtube.com/watch?v=dQw4w9WgXcQ")?.videoId).toBe("dQw4w9WgXcQ");
  });
});
