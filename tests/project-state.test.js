import { describe, it, expect } from "vitest";
import {
  applyProjectPatch,
  buildProjectSnapshot,
  createInitialProjectState,
  normalizeLoadPayload,
  pickSnapshotFields,
  projectReducer,
} from "../app/lib/project-state.js";
import { BLANK_STATE } from "../app/lib/music-config.js";

describe("project-state", () => {
  it("applyProjectPatch supports functional updates", () => {
    const state = createInitialProjectState({ rules: "a" });
    const next = applyProjectPatch(state, {
      rules: (prev) => `${prev}\nb`,
      selectedGenres: (prev) => [...prev, "Techno"],
    });
    expect(next.rules).toBe("a\nb");
    expect(next.selectedGenres).toContain("Techno");
  });

  it("LOAD merges normalized payload", () => {
    const next = projectReducer(createInitialProjectState(), {
      type: "LOAD",
      payload: { idea: "new idea", selectedGenres: ["House"] },
    });
    expect(next.idea).toBe("new idea");
    expect(next.selectedGenres).toEqual(["House"]);
  });

  it("RESET_BLANK applies blank slate fields", () => {
    const seeded = createInitialProjectState({
      idea: "x",
      selectedGenres: ["Techno"],
      generatedLyrics: "hello",
    });
    const next = projectReducer(seeded, { type: "RESET_BLANK" });
    expect(next.idea).toBe(BLANK_STATE.idea);
    expect(next.selectedGenres).toEqual([]);
    expect(next.generatedLyrics).toBe("");
    expect(next.guidedStep).toBe(0);
  });

  it("RESET_BLANK clears voice fields and resets LLM/style DNA to defaults", () => {
    const seeded = createInitialProjectState({
      notes: "session notes",
      voiceRefFirstName: "Ada",
      voiceRefLastName: "Lovelace",
      voiceStyleLine: "whispered soprano",
      coProducerLlmSettings: { enabled: true, apiKey: "sk-test", model: "gpt-4" },
      styleDnaSettings: { spotifyClientId: "id", spotifyClientSecret: "secret" },
    });
    const next = projectReducer(seeded, { type: "RESET_BLANK" });
    expect(next.notes).toBe("");
    expect(next.voiceRefFirstName).toBe("");
    expect(next.voiceRefLastName).toBe("");
    expect(next.voiceStyleLine).toBe("");
    expect(next.coProducerLlmSettings).toEqual(createInitialProjectState().coProducerLlmSettings);
    expect(next.styleDnaSettings).toEqual(createInitialProjectState().styleDnaSettings);
  });

  it("RESET_BLANK keeps custom style presets in memory", () => {
    const customPresets = { "My Techno": { genres: ["Techno"], rules: "hard" } };
    const seeded = createInitialProjectState({
      idea: "filled",
      customPresets,
    });
    const next = projectReducer(seeded, { type: "RESET_BLANK" });
    expect(next.idea).toBe("");
    expect(next.customPresets).toEqual(customPresets);
  });

  it("normalizeLoadPayload clamps guided step", () => {
    expect(normalizeLoadPayload({ guidedStep: -3 }).guidedStep).toBe(0);
  });

  it("pickSnapshotFields selects only persisted snapshot keys", () => {
    const picked = pickSnapshotFields({
      idea: "goal",
      tempo: "128 BPM",
      audioAnalysis: { fileName: "a.wav" },
      presetName: "ignored",
      coProducerLlmSettings: { provider: "x" },
    });
    expect(picked.idea).toBe("goal");
    expect(picked.audioAnalysis).toEqual({ fileName: "a.wav" });
    expect(picked).not.toHaveProperty("presetName");
    expect(picked).not.toHaveProperty("coProducerLlmSettings");
  });

  it("buildProjectSnapshot embeds version and analyzer refs for undo/autosave", () => {
    const snap = buildProjectSnapshot("0.9.1", {
      idea: "My goal",
      tempo: "128 BPM",
      structure: "intro → drop",
      selectedGenres: ["Techno"],
      selectedRhythms: ["4/4"],
      selectedSounds: ["Sub bass"],
      vocal: "Instrumental",
      mode: "Hybrid",
      proMode: false,
      promptIntensity: 50,
      variationCount: 3,
      rules: "no mumble",
      notes: "ref track",
      scores: { bass: 8, rhythm: 7, identity: 9, clarity: 8 },
      mood: { energy: 70, aggression: 40, darkness: 55, emotion: 50, complexity: 45, space: 60 },
      audioAnalysis: { fileName: "bed.wav", duration: 120 },
      imageAnalysis: null,
      lyricTheme: "night drive",
      lyricLanguage: "English",
      lyricStructure: "verse → chorus",
      lyricStyle: "Club chant",
      lyricDensity: 55,
      promptFormat: "Standard",
      promptEngine: "Suno-like",
      coProducerOutput: "",
      generatedLyrics: "[Verse 1]\nline",
      generatedLyricsStyle: "Club chant",
      generatedHooks: "hook",
      generatedHooksStyle: "Club chant",
      lyricVariantSeed: 2,
      lyricMode: "Structured Song",
      voiceRefFirstName: "",
      voiceRefLastName: "",
      voiceStyleLine: "",
      instrumentalVocalFx: false,
      guidedStep: 5,
      variations: [{ id: "a", prompt: "p" }],
      history: [{ id: "h1", label: "snap" }],
      selectedHistoryId: "h1",
    });

    expect(snap.appVersion).toBe("0.9.1");
    expect(snap.idea).toBe("My goal");
    expect(snap.audioAnalysis).toEqual({ fileName: "bed.wav", duration: 120 });
    expect(snap.guidedStep).toBe(5);
    expect(snap.variations).toHaveLength(1);
    expect(snap.history[0].label).toBe("snap");
  });
});
