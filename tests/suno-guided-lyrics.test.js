import { describe, it, expect } from "vitest";
import { buildSunoPastedLyricsField } from "../app/lib/suno-guided-workflow.js";
import { SUNO_LYRICS_CHAR_TYPICAL_MAX } from "../app/lib/suno-limits.js";

describe("buildSunoPastedLyricsField", () => {
  it("keeps theme before long body when trimming", () => {
    const longBody = "x".repeat(6000);
    const out = buildSunoPastedLyricsField({
      vocal: "Lead Vocal",
      lyricTheme: "night drive",
      lyricLanguage: "English",
      lyricStructure: "verse → chorus",
      lyricPrompt: longBody,
    });
    expect(out.length).toBeLessThanOrEqual(SUNO_LYRICS_CHAR_TYPICAL_MAX);
    expect(out.startsWith("theme: night drive")).toBe(true);
  });
});
