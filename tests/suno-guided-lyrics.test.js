import { describe, it, expect } from "vitest";
import {
  buildMinimalLyricsScaffold,
  buildSunoPastedLyricsField,
  buildSunoPastedStyleLine,
} from "../app/lib/suno-guided-workflow.js";
import { SUNO_LYRICS_CHAR_TYPICAL_MAX } from "../app/lib/suno-limits.js";

describe("buildSunoPastedStyleLine", () => {
  it("outputs comma-separated tokens without internal labels", () => {
    const out = buildSunoPastedStyleLine({
      selectedGenres: ["Techno", "Industrial"],
      tempo: "130 BPM",
      moodWords: "dark, driving",
      selectedSounds: ["Heavy sub bass"],
      selectedRhythms: ["4/4"],
      vocal: "Instrumental",
      idea: "underground club energy",
      rules: "no vocals, clean low end",
    });
    expect(out).toContain("Techno");
    expect(out).toContain("130 BPM");
    expect(out).not.toMatch(/\bsounds:/i);
    expect(out).not.toMatch(/\brules:/i);
    expect(out).not.toMatch(/\bgoal:/i);
    expect(out).not.toMatch(/\bmode:/i);
  });
});

describe("buildSunoPastedLyricsField", () => {
  it("keeps generated lyrics without theme metadata prefixes", () => {
    const longBody = "x".repeat(6000);
    const out = buildSunoPastedLyricsField({
      vocal: "Lead Vocal",
      lyricTheme: "night drive",
      generatedLyrics: longBody,
    });
    expect(out.length).toBeLessThanOrEqual(SUNO_LYRICS_CHAR_TYPICAL_MAX);
    expect(out.startsWith("theme:")).toBe(false);
    expect(out.startsWith("x")).toBe(true);
  });

  it("builds bracket scaffold from theme and structure", () => {
    const out = buildSunoPastedLyricsField({
      vocal: "Male Lead",
      lyricTheme: "night drive",
      lyricStructure: "verse → chorus → bridge",
    });
    expect(out).toContain("[Verse 1]");
    expect(out).toContain("night drive");
    expect(out).not.toContain("theme:");
  });

  it("returns instrumental-only scaffold", () => {
    expect(buildSunoPastedLyricsField({ vocal: "Instrumental" })).toContain("[No Vocals]");
  });
});

describe("buildMinimalLyricsScaffold", () => {
  it("maps structure arrows to section tags", () => {
    const out = buildMinimalLyricsScaffold({
      lyricTheme: "hold on",
      lyricStructure: "intro → chorus → outro",
    });
    expect(out).toContain("[Intro]");
    expect(out).toContain("[Chorus]");
    expect(out).toContain("hold on");
  });
});
