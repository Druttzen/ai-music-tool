import { describe, it, expect } from "vitest";
import {
  buildSunoStyleBoxPrompt,
  buildSunoLyricsBoxPrompt,
  buildStandardPrompt,
  SUNO_AUTO_FIX_DEFAULTS,
  validateSunoLikePrompt,
} from "../app/lib/suno-rules.js";

const base = {
  selectedGenres: ["Techno"],
  tempo: "130 BPM",
  moodWords: "dark, driving",
  selectedSounds: ["Heavy sub bass"],
  selectedRhythms: ["4/4"],
  vocalText: "instrumental",
  structure: "intro → drop → outro",
  idea: "underground club energy at night",
  vocal: "Instrumental",
  rules: "no vocals, clean low end",
  intensityText: "steady build",
  mode: "Hybrid",
  voiceStyleReference: "",
  lyricPrompt: "[Verse]\nLine one",
  lyricStyle: "Raw",
  lyricTheme: "night drive",
  instrumentalVocalFx: false,
  audioAnalysis: null,
  imageAnalysis: null,
  coProducerOutput: "",
  notes: "",
};

describe("suno-rules", () => {
  it("builds style box with DNA section", () => {
    const s = buildSunoStyleBoxPrompt(base);
    expect(s).toContain("DNA:");
    expect(s).toContain("Techno");
  });

  it("instrumental lyrics box uses v5.5 scaffold", () => {
    const l = buildSunoLyricsBoxPrompt({ vocal: "Instrumental", lyricPrompt: "x" });
    expect(l).toContain("[No Vocals]");
    expect(l).toContain("[Instrumental]");
  });

  it("validateSunoLikePrompt flags missing genres", () => {
    const w = validateSunoLikePrompt({ ...base, selectedGenres: [] });
    expect(w.length).toBeGreaterThan(0);
  });

  it("validateSunoLikePrompt warns when style descriptors are sparse", () => {
    const w = validateSunoLikePrompt({
      ...base,
      selectedGenres: ["Techno"],
      moodWords: "dark",
      selectedSounds: ["Heavy sub bass"],
    });
    expect(w.some((x) => x.includes("4–8"))).toBe(true);
  });

  it("buildStandardPrompt compressed format is single block", () => {
    const p = buildStandardPrompt({ ...base, format: "Compressed" });
    expect(p).toContain("Techno | 130 BPM");
    expect(p).toContain("Rules:");
    expect(p).not.toContain("STYLE:");
  });

  it("buildStandardPrompt detailed format includes song map", () => {
    const p = buildStandardPrompt({ ...base, format: "Detailed" });
    expect(p).toContain("SONG MAP:");
    expect(p).toContain("Intensity:");
  });

  it("buildStandardPrompt includes score focus when bass is weak", () => {
    const p = buildStandardPrompt({
      ...base,
      format: "Compressed",
      scores: { bass: 2, rhythm: 4, identity: 4, clarity: 4 },
    });
    expect(p).toContain("SCORE FOCUS:");
    expect(p).toContain("sub foundation");
  });

  it("buildSunoStyleBoxPrompt includes score focus block", () => {
    const s = buildSunoStyleBoxPrompt({
      ...base,
      scores: { bass: 5, rhythm: 5, identity: 4, clarity: 4 },
    });
    expect(s).toContain("SCORE FOCUS:");
    expect(s).toContain("tight rhythmic pocket");
  });

  it("SUNO_AUTO_FIX_DEFAULTS provides genre and structure fallbacks", () => {
    expect(SUNO_AUTO_FIX_DEFAULTS.genres).toEqual(["Techno"]);
    expect(SUNO_AUTO_FIX_DEFAULTS.structure.length).toBeGreaterThan(8);
  });
});
