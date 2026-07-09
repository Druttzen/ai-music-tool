import { describe, it, expect } from "vitest";
import {
  lyricLanguageOptions,
  SUNO_LYRIC_LANGUAGE_CATALOG,
  getSunoLanguagePromptRules,
  normalizeLyricLanguage,
  applyLanguageFlavorToContent,
} from "../app/lib/suno-lyric-languages.js";

describe("suno-lyric-languages", () => {
  it("lists Suno-supported languages plus special options", () => {
    expect(lyricLanguageOptions.length).toBeGreaterThanOrEqual(30);
    expect(lyricLanguageOptions).toContain("English");
    expect(lyricLanguageOptions).toContain("Spanish");
    expect(lyricLanguageOptions).toContain("Japanese");
    expect(lyricLanguageOptions).toContain("Bilingual (declare in section tags)");
    expect(lyricLanguageOptions).toContain("No specific language");
  });

  it("maps legacy Mixed English/Swedish to bilingual", () => {
    expect(normalizeLyricLanguage("Mixed English/Swedish")).toBe(
      "Bilingual (declare in section tags)",
    );
  });

  it("preserves blank language for reset slate", () => {
    expect(normalizeLyricLanguage("")).toBe("");
    expect(normalizeLyricLanguage(undefined)).toBe("English");
  });

  it("returns Spanish prompt rules with section tag guidance", () => {
    const rules = getSunoLanguagePromptRules("Spanish");
    expect(rules).toContain("Spanish");
    expect(rules).toContain("no English ad-libs");
  });

  it("applies Spanish sample phrases to generated content", () => {
    const base = {
      signatureLine: "Shadows move under my skin",
      verse: ["Neon rain on empty streets"],
      chorus: ["In the dark we come alive"],
      hooks: ["In the dark we come alive"],
    };
    const localized = applyLanguageFlavorToContent(base, "Spanish");
    expect(localized.signatureLine).toContain("sombras");
    expect(localized.chorus[0]).toMatch(/oscuridad|vida/i);
  });

  it("catalog includes strong and extended Suno language tiers", () => {
    const strong = SUNO_LYRIC_LANGUAGE_CATALOG.filter((l) => l.tier === "strong");
    const extended = SUNO_LYRIC_LANGUAGE_CATALOG.filter((l) => l.tier === "extended");
    expect(strong.length).toBeGreaterThanOrEqual(16);
    expect(extended.length).toBeGreaterThanOrEqual(10);
  });
});
