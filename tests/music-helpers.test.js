import { describe, it, expect } from "vitest";
import { buildLyricPrompt } from "../app/lib/music-helpers.js";

describe("buildLyricPrompt", () => {
  const base = {
    lyricDensity: 50,
    lyricLanguage: "English",
    lyricStyle: "Dark poetic",
    lyricMode: "Structured Song",
    lyricStructure: "",
    selectedGenres: [],
    moodWords: "balanced",
  };

  it("returns blank placeholder when vocal and theme are empty (reset slate)", () => {
    const out = buildLyricPrompt({ ...base, vocal: "", lyricTheme: "" });
    expect(out).toContain("select vocal mode and lyric theme");
    expect(out).not.toContain("LYRIC STYLE");
  });

  it("returns instrumental line when vocal is Instrumental", () => {
    const out = buildLyricPrompt({ ...base, vocal: "Instrumental", lyricTheme: "" });
    expect(out).toContain("instrumental only");
  });

  it("builds full direction when vocal and theme are set", () => {
    const out = buildLyricPrompt({
      ...base,
      vocal: "Male Lead",
      lyricTheme: "night drive",
    });
    expect(out).toContain("LYRIC STYLE");
    expect(out).toContain("night drive");
  });
});
