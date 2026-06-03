import { describe, it, expect } from "vitest";
import {
  buildSunoStyleBoxPrompt,
  buildSunoLyricsBoxPrompt,
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
  instrumentalVocalFx: false,
};

describe("suno-rules", () => {
  it("builds style box with DNA section", () => {
    const s = buildSunoStyleBoxPrompt(base);
    expect(s).toContain("DNA:");
    expect(s).toContain("Techno");
  });

  it("instrumental lyrics box is fixed string", () => {
    const l = buildSunoLyricsBoxPrompt({ vocal: "Instrumental", lyricPrompt: "x" });
    expect(l).toBe("Instrumental only. No lyrical content.");
  });

  it("validateSunoLikePrompt flags missing genres", () => {
    const w = validateSunoLikePrompt({ ...base, selectedGenres: [] });
    expect(w.length).toBeGreaterThan(0);
  });
});
