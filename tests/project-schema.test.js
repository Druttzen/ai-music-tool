import { describe, it, expect } from "vitest";
import {
  PROJECT_FIELDS,
  PROJECT_PATCH_KEYS,
  PROJECT_SCHEMA_KEYS,
  ProjectStateSchema,
  SNAPSHOT_FIELD_KEYS,
  normalizeLoadPayloadFromFields,
} from "../app/lib/project-schema";
import { DEFAULT_STATE } from "../app/lib/music-config.js";

const EXPECTED_PATCH_KEYS = [
  "idea",
  "tempo",
  "structure",
  "selectedGenres",
  "selectedRhythms",
  "selectedSounds",
  "vocal",
  "mode",
  "proMode",
  "promptIntensity",
  "variationCount",
  "rules",
  "notes",
  "scores",
  "mood",
  "lyricTheme",
  "lyricLanguage",
  "lyricStructure",
  "lyricStyle",
  "lyricDensity",
  "promptFormat",
  "promptEngine",
  "coProducerOutput",
  "generatedLyrics",
  "generatedLyricsStyle",
  "generatedHooks",
  "generatedHooksStyle",
  "lyricVariantSeed",
  "lyricMode",
  "voiceRefFirstName",
  "voiceRefLastName",
  "voiceStyleLine",
  "instrumentalVocalFx",
  "sunoPasteStyle",
  "sunoPasteLyrics",
  "sunoPasteActive",
  "guidedStep",
  "variations",
  "history",
  "selectedHistoryId",
  "presetName",
  "customPresets",
  "copied",
  "lyricsGenerateBusy",
  "coProducerLlmSettings",
  "styleDnaSettings",
];

const EXPECTED_SNAPSHOT_KEYS = [
  "idea",
  "tempo",
  "structure",
  "selectedGenres",
  "selectedRhythms",
  "selectedSounds",
  "vocal",
  "mode",
  "proMode",
  "promptIntensity",
  "variationCount",
  "rules",
  "notes",
  "scores",
  "mood",
  "audioAnalysis",
  "imageAnalysis",
  "lyricTheme",
  "lyricLanguage",
  "lyricStructure",
  "lyricStyle",
  "lyricDensity",
  "promptFormat",
  "promptEngine",
  "coProducerOutput",
  "generatedLyrics",
  "generatedLyricsStyle",
  "generatedHooks",
  "generatedHooksStyle",
  "lyricVariantSeed",
  "lyricMode",
  "voiceRefFirstName",
  "voiceRefLastName",
  "voiceStyleLine",
  "instrumentalVocalFx",
  "sunoPasteStyle",
  "sunoPasteLyrics",
  "sunoPasteActive",
  "guidedStep",
  "variations",
  "history",
  "selectedHistoryId",
];

describe("project-schema registry", () => {
  it("derives the exact PROJECT_PATCH_KEYS contract", () => {
    expect(PROJECT_PATCH_KEYS).toEqual(EXPECTED_PATCH_KEYS);
  });

  it("derives the exact SNAPSHOT_FIELD_KEYS contract", () => {
    expect(SNAPSHOT_FIELD_KEYS).toEqual(EXPECTED_SNAPSHOT_KEYS);
  });

  it("analyzer refs are snapshot-only (not patchable, not loaded)", () => {
    for (const key of ["audioAnalysis", "imageAnalysis"]) {
      const def = PROJECT_FIELDS.find((f) => f.key === key);
      expect(def).toBeTruthy();
      expect(def.snapshot).toBe(true);
      expect(def.patch).toBe(false);
      expect(def.load).toBe(false);
    }
  });

  it("settings/runtime fields are patch-only", () => {
    for (const key of ["customPresets", "coProducerLlmSettings", "styleDnaSettings", "copied"]) {
      const def = PROJECT_FIELDS.find((f) => f.key === key);
      expect(def.patch).toBe(true);
      expect(def.snapshot).toBe(false);
      expect(def.load).toBe(false);
    }
  });
});

describe("normalizeLoadPayloadFromFields", () => {
  it("returns {} for non-objects", () => {
    expect(normalizeLoadPayloadFromFields(null)).toEqual({});
    expect(normalizeLoadPayloadFromFields("nope")).toEqual({});
  });

  it("clamps guided step and normalizes variations", () => {
    expect(normalizeLoadPayloadFromFields({ guidedStep: -3 }).guidedStep).toBe(0);
    expect(normalizeLoadPayloadFromFields({ guidedStep: NaN }).guidedStep).toBe(0);
    expect(normalizeLoadPayloadFromFields({ guidedStep: 4 }).guidedStep).toBe(4);
    expect(normalizeLoadPayloadFromFields({ variations: "x" }).variations).toEqual([]);
  });

  it("only restores history when an array is provided", () => {
    expect("history" in normalizeLoadPayloadFromFields({})).toBe(false);
    expect("history" in normalizeLoadPayloadFromFields({ history: "bad" })).toBe(false);
    const withHistory = normalizeLoadPayloadFromFields({ history: [{ id: "h1" }] });
    expect(withHistory.history).toEqual([{ id: "h1" }]);
  });

  it("defaults selectedHistoryId to null and never emits analyzer/settings fields", () => {
    const out = normalizeLoadPayloadFromFields({ idea: "x" });
    expect(out.selectedHistoryId).toBe(null);
    expect(out).not.toHaveProperty("audioAnalysis");
    expect(out).not.toHaveProperty("customPresets");
    expect(out).not.toHaveProperty("coProducerLlmSettings");
  });
});

describe("ProjectStateSchema (Zod contract)", () => {
  it("every schema key is a registered load field (no drift)", () => {
    const loadKeys = new Set(PROJECT_FIELDS.filter((f) => f.load).map((f) => f.key));
    for (const key of PROJECT_SCHEMA_KEYS) {
      expect(loadKeys.has(key)).toBe(true);
    }
  });

  it("validates a DEFAULT_STATE-shaped project payload", () => {
    const payload = {
      ...DEFAULT_STATE,
      guidedStep: 0,
      variations: [],
      history: [],
      selectedHistoryId: null,
    };
    const result = ProjectStateSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it("rejects a malformed payload (wrong types)", () => {
    const result = ProjectStateSchema.safeParse({ idea: 123, selectedGenres: "nope" });
    expect(result.success).toBe(false);
  });
});
