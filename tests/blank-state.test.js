import { describe, it, expect } from "vitest";
import { BLANK_STATE, DEFAULT_STATE } from "../app/lib/music-config.js";

describe("BLANK_STATE", () => {
  it("has no preselected genres, sounds, rhythms, or rules", () => {
    expect(BLANK_STATE.selectedGenres).toEqual([]);
    expect(BLANK_STATE.selectedRhythms).toEqual([]);
    expect(BLANK_STATE.selectedSounds).toEqual([]);
    expect(BLANK_STATE.rules).toBe("");
    expect(BLANK_STATE.idea).toBe("");
    expect(BLANK_STATE.lyricTheme).toBe("");
    expect(BLANK_STATE.notes).toBe("");
    expect(BLANK_STATE.coProducerOutput).toBe("");
    expect(BLANK_STATE.generatedLyrics).toBe("");
  });

  it("does not copy factory demo selections from DEFAULT_STATE", () => {
    expect(BLANK_STATE.selectedGenres).not.toEqual(DEFAULT_STATE.selectedGenres);
    expect(BLANK_STATE.rules).not.toEqual(DEFAULT_STATE.rules);
    expect(BLANK_STATE.idea).not.toEqual(DEFAULT_STATE.idea);
  });

  it("starts guided path at step 1 with neutral mood sliders", () => {
    expect(BLANK_STATE.guidedStep).toBe(0);
    expect(BLANK_STATE.mood.energy).toBe(50);
    expect(BLANK_STATE.mood.darkness).toBe(50);
  });

  it("leaves lyric dropdowns unselected", () => {
    expect(BLANK_STATE.lyricStyle).toBe("");
    expect(BLANK_STATE.lyricMode).toBe("");
    expect(BLANK_STATE.lyricLanguage).toBe("");
  });
});
