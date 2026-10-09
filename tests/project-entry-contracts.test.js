import { describe, it, expect } from "vitest";
import { HistoryEntrySchema, VariationEntrySchema, normalizeHistoryEntries, normalizeVariationEntries, normalizeProjectEntryCollections } from "../app/lib/project-entries";
import { ProjectStateSchema, normalizeLoadPayloadFromFields } from "../app/lib/project-schema";
import { migrateImportedProject, slimStateForUndo } from "../app/lib/project-persistence";

const history = { id: 1791571000000, label: "Manual snapshot", time: "21:45:00", prompt: "Techno", state: { idea: "Original", audioAnalysis: { fileName: "track.wav" }, history: [] }, avgScore: "3.0" };
const variation = { id: 1791571000001, title: "Variation 1", prompt: "Core: Techno" };

describe("actual history and variation contracts", () => {
  it("accepts the existing producers without invented timestamp or patch fields", () => {
    expect(HistoryEntrySchema.parse(history)).toEqual(history);
    expect(VariationEntrySchema.parse(variation)).toEqual(variation);
    expect(ProjectStateSchema.partial().safeParse({ history: [history], variations: [variation], selectedHistoryId: history.id }).success).toBe(true);
  });
  it("preserves legacy string IDs, optional scores and unknown snapshot data", () => {
    const legacy = { ...history, id: "h1", avgScore: undefined, futureMetadata: { source: "import" } };
    expect(HistoryEntrySchema.parse(legacy)).toEqual(legacy);
    expect(ProjectStateSchema.partial().safeParse({ selectedHistoryId: "h1" }).success).toBe(true);
  });
  it("rejects missing fields, array snapshots and invalid IDs", () => {
    for (const entry of [null, { id: 1 }, { ...history, state: [] }, { ...history, id: NaN }, { ...history, prompt: 12 }]) {
      expect(HistoryEntrySchema.safeParse(entry).success).toBe(false);
    }
    expect(VariationEntrySchema.safeParse({ ...variation, title: 12 }).success).toBe(false);
  });
  it("recovers valid entries independently and leaves source data untouched", () => {
    const raw = { idea: "Keep my project", history: [history, null], variations: [false, variation], imageAnalysis: { summary: "cover" } };
    const recovered = normalizeProjectEntryCollections(raw);
    expect(recovered).toEqual({ ...raw, history: [history], variations: [variation] });
    expect(raw.history).toHaveLength(2);
    expect(normalizeHistoryEntries({})).toEqual([]);
    expect(normalizeVariationEntries(null)).toEqual([]);
  });
  it("LOAD validates lists without wiping history on a partial load", () => {
    expect(normalizeLoadPayloadFromFields({ history: [history, {}], variations: [variation, {}] }).history).toEqual([history]);
    expect(normalizeLoadPayloadFromFields({ variations: [variation, {}] }).variations).toEqual([variation]);
    expect(normalizeLoadPayloadFromFields({ idea: "change" })).not.toHaveProperty("history");
  });
  it("import and undo retain numeric selection and analyzer snapshots", () => {
    const state = { idea: "Song", history: [history], variations: [variation], selectedHistoryId: history.id };
    const imported = migrateImportedProject(state, "0.50.49");
    expect(normalizeLoadPayloadFromFields(imported).history).toEqual([history]);
    expect(slimStateForUndo(state).selectedHistoryId).toBe(history.id);
    expect(ProjectStateSchema.partial().safeParse(imported).success).toBe(true);
  });
});
