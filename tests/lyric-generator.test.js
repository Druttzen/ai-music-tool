import { describe, it, expect } from "vitest";
import {
  generateCoProducerLyrics,
  generateCoProducerHooks,
  getLyricStyleDirection,
  formatLyricsCharBudget,
  mergeInstrumentalScaffoldWithStyleLyrics,
  LYRIC_STYLE_DIRECTIONS,
} from "../app/lib/lyric-generator.js";

const baseInput = {
  vocal: "Lead Vocal",
  lyricStyle: "Dark poetic",
  lyricTheme: "night drive through the city",
  lyricMode: "Structured Song",
  lyricLanguage: "English",
  lyricStructure: "verse → chorus → bridge",
  lyricDensity: 55,
  mood: { energy: 60, darkness: 70, emotion: 55 },
  moodWords: "dark, driving, hypnotic",
  selectedGenres: ["Techno"],
  idea: "late night warehouse",
  variantSeed: 0,
};

describe("generateCoProducerLyrics", () => {
  it("covers every lyric style preset", () => {
    for (const style of Object.keys(LYRIC_STYLE_DIRECTIONS)) {
      const out = generateCoProducerLyrics({ ...baseInput, lyricStyle: style });
      expect(out.styleLabel).toBe(style);
      expect(out.lyrics).toContain(style);
      expect(out.lyrics).toContain(getLyricStyleDirection(style));
    }
  });

  it("returns bracketed skip message in instrumental mode", () => {
    const out = generateCoProducerLyrics({ ...baseInput, vocal: "Instrumental" });
    expect(out.lyrics).toMatch(/^\[.*\]$/);
    expect(out.lyrics.toLowerCase()).toContain("instrumental");
  });

  it("raw prompt mode uses bracketed Suno direction with style signature", () => {
    const out = generateCoProducerLyrics({
      ...baseInput,
      lyricStyle: "Club chant",
      lyricMode: "Raw Prompt",
    });
    expect(out.lyrics).toContain("[");
    expect(out.lyrics).toContain("Club chant");
    expect(out.lyrics).toContain("Hands up, bass down, move now");
  });

  it("structured song includes section tags and theme", () => {
    const out = generateCoProducerLyrics({
      ...baseInput,
      lyricStyle: "Robotic cyber",
      lyricMode: "Structured Song",
    });
    expect(out.lyrics).toContain("[Verse 1]");
    expect(out.lyrics).toContain("[Chorus]");
    expect(out.lyrics).toContain("night drive through the city");
    expect(out.lyrics).toContain("Metal heart, electric mind");
  });

  it("variant seed produces different verse picks", () => {
    const a = generateCoProducerLyrics({ ...baseInput, variantSeed: 0 });
    const b = generateCoProducerLyrics({ ...baseInput, variantSeed: 5 });
    expect(a.lyrics).not.toBe(b.lyrics);
  });

  it("Swedish language uses Swedish phrases for Dark poetic", () => {
    const out = generateCoProducerLyrics({
      ...baseInput,
      lyricLanguage: "Swedish",
      lyricStyle: "Dark poetic",
    });
    expect(out.lyrics).toContain("Skuggor");
  });

  it("dense lyric density adds more lines", () => {
    const sparse = generateCoProducerLyrics({ ...baseInput, lyricDensity: 20 });
    const dense = generateCoProducerLyrics({ ...baseInput, lyricDensity: 90 });
    expect(dense.lyrics.length).toBeGreaterThan(sparse.lyrics.length);
  });
});

describe("generateCoProducerHooks", () => {
  it("includes style label and direction", () => {
    const out = generateCoProducerHooks({
      ...baseInput,
      lyricStyle: "Aggressive hype",
    });
    expect(out.hooks).toContain("Aggressive hype");
    expect(out.hooks).toContain(getLyricStyleDirection("Aggressive hype"));
  });
});

describe("mergeInstrumentalScaffoldWithStyleLyrics", () => {
  it("appends co-producer draft after scaffold", () => {
    const merged = mergeInstrumentalScaffoldWithStyleLyrics("[Verse 1 — 0:10]", {
      lyrics: "[Verse 1]\nLine one",
      styleLabel: "Club chant",
      styleDirection: getLyricStyleDirection("Club chant"),
    });
    expect(merged).toContain("[Verse 1 — 0:10]");
    expect(merged).toContain("Co-Producer singable draft");
    expect(merged).toContain("Club chant");
  });
});

describe("formatLyricsCharBudget", () => {
  it("flags near and over limits", () => {
    expect(formatLyricsCharBudget("hello").isOver).toBe(false);
    expect(formatLyricsCharBudget("x".repeat(4900)).isWarn).toBe(true);
    expect(formatLyricsCharBudget("x".repeat(5100)).isOver).toBe(true);
  });
});
