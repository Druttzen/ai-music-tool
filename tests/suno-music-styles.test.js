import { describe, it, expect } from "vitest";
import {
  genreOptions,
  soundOptions,
  rhythmOptions,
  SUNO_GENRE_GROUPS,
  SUNO_INSTRUMENT_GROUPS,
  SUNO_GENRE_WHEEL_COUNT,
  filterSunoStyleOptions,
} from "../app/lib/suno-music-styles.js";

describe("suno-music-styles", () => {
  it("exports Suno-scale genre, instrument, and rhythm lists", () => {
    expect(genreOptions.length).toBeGreaterThanOrEqual(100);
    expect(soundOptions.length).toBeGreaterThanOrEqual(100);
    expect(rhythmOptions.length).toBeGreaterThanOrEqual(20);
    expect(SUNO_GENRE_WHEEL_COUNT).toBeGreaterThanOrEqual(900);
  });

  it("includes major Suno genre families", () => {
    for (const g of [
      "Techno",
      "Hip Hop",
      "Pop",
      "Rock",
      "Jazz",
      "Reggaeton",
      "K-Pop",
      "Afrobeats",
      "Phonk",
    ]) {
      expect(genreOptions).toContain(g);
    }
  });

  it("includes Suno-reliable instrument tags", () => {
    for (const s of ["808 bass", "Rhodes electric piano", "Sitar", "Steel drums", "Hammond organ"]) {
      expect(soundOptions).toContain(s);
    }
  });

  it("groups genres and instruments for searchable UI", () => {
    expect(SUNO_GENRE_GROUPS.length).toBeGreaterThanOrEqual(8);
    expect(SUNO_INSTRUMENT_GROUPS.length).toBeGreaterThanOrEqual(6);
    const electronic = SUNO_GENRE_GROUPS.find((g) => g.label === "Electronic & club");
    expect(electronic?.items.some((i) => i.label === "Techno")).toBe(true);
  });

  it("filterSunoStyleOptions searches within a group", () => {
    const filtered = filterSunoStyleOptions("techno", genreOptions, "Electronic & club", SUNO_GENRE_GROUPS);
    expect(filtered.some((x) => x.toLowerCase().includes("techno"))).toBe(true);
    expect(filtered).not.toContain("Pop");
  });
});
