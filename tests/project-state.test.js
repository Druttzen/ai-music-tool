import { describe, it, expect } from "vitest";
import {
  applyProjectPatch,
  createInitialProjectState,
  normalizeLoadPayload,
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

  it("normalizeLoadPayload clamps guided step", () => {
    expect(normalizeLoadPayload({ guidedStep: -3 }).guidedStep).toBe(0);
  });
});
