import { describe, it, expect } from "vitest";
import {
  attachCharacterVoicePresetsToProjectExport,
} from "../app/lib/voice-character-preset.js";
import {
  attachCharacterVoiceStudioSessionToProjectExport,
  extractCharacterVoiceStudioSessionFromProject,
  isCharacterVoiceStudioSessionEmpty,
  normalizeCharacterVoiceStudioSession,
} from "../app/lib/voice-character-studio-session.js";

describe("voice-character-studio-session", () => {
  const session = {
    voiceAnalysis: {
      characterLabel: "baritone register, breathy, moderate phrasing",
      textureTags: ["breathy", "steady pitch"],
      registerLabel: "baritone register",
      deliveryPace: "moderate phrasing",
      suggestedVocalRole: "Male Lead",
    },
    voiceStyleCompact: {
      style: "E2E Narrator, baritone register",
      lyricTag: "[Vocal character: E2E Narrator — breathy, steady pitch; trait-based Suno direction]",
    },
    youtubeReference: null,
    presetName: "E2E Narrator",
  };

  it("normalizeCharacterVoiceStudioSession coerces invalid textureTags", () => {
    const out = normalizeCharacterVoiceStudioSession({
      voiceAnalysis: { characterLabel: "x", textureTags: "bad" },
      presetName: " A ",
    });
    expect(out.voiceAnalysis.textureTags).toEqual([]);
    expect(out.presetName).toBe("A");
  });

  it("extractCharacterVoiceStudioSessionFromProject reads optional field", () => {
    expect(extractCharacterVoiceStudioSessionFromProject({ characterVoiceStudioSession: session }).presetName).toBe(
      "E2E Narrator",
    );
    expect(extractCharacterVoiceStudioSessionFromProject({ idea: "x" })).toBeNull();
  });

  it("attachCharacterVoiceStudioSessionToProjectExport skips empty session", () => {
    expect(attachCharacterVoiceStudioSessionToProjectExport({ idea: "test" }, session).characterVoiceStudioSession).toBeTruthy();
    expect(
      attachCharacterVoiceStudioSessionToProjectExport(
        { idea: "test" },
        normalizeCharacterVoiceStudioSession({}),
      ),
    ).toEqual({ idea: "test" });
  });

  it("isCharacterVoiceStudioSessionEmpty detects blank session", () => {
    expect(isCharacterVoiceStudioSessionEmpty(normalizeCharacterVoiceStudioSession({}))).toBe(true);
    expect(isCharacterVoiceStudioSessionEmpty(normalizeCharacterVoiceStudioSession(session))).toBe(false);
  });

  it("attachCharacterVoiceStudioSession chains with preset export payload", () => {
    const preset = {
      Alpha: { name: "Alpha", analysis: session.voiceAnalysis, voiceStyleLine: "line" },
    };
    const out = attachCharacterVoiceStudioSessionToProjectExport(
      attachCharacterVoicePresetsToProjectExport({ idea: "bundle" }, preset),
      session,
    );
    expect(out.idea).toBe("bundle");
    expect(out.characterVoicePresets.Alpha.name).toBe("Alpha");
    expect(out.characterVoiceStudioSession.presetName).toBe("E2E Narrator");
  });
});
