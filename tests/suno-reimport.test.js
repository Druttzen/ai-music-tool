import { describe, it, expect } from "vitest";
import {
  applySunoPasteToSlices,
  buildSunoPasteDiff,
  extractLyricsBodyFromPaste,
  hasSunoPasteContent,
  normalizePasteLine,
} from "../app/lib/suno-reimport.js";

describe("suno-reimport", () => {
  it("buildSunoPasteDiff flags changed Style and matching Lyrics", () => {
    const diff = buildSunoPasteDiff({
      projectStyle: "Techno, dark, 130 BPM",
      projectLyrics: "[Dark poetic]\nLine one",
      pastedStyle: "Techno, darker, 130 BPM",
      pastedLyrics: "[Dark poetic]\nLine one",
    });
    expect(diff.find((s) => s.id === "style")?.changed).toBe(true);
    expect(diff.find((s) => s.id === "lyrics")?.changed).toBe(false);
  });

  it("applySunoPasteToSlices overrides built slices when active", () => {
    const built = { style: "built style", lyrics: "built lyrics" };
    const inactive = applySunoPasteToSlices(built, {
      sunoPasteActive: false,
      sunoPasteStyle: " pasted ",
      sunoPasteLyrics: " pasted lyrics ",
    });
    expect(inactive).toEqual(built);

    const active = applySunoPasteToSlices(built, {
      sunoPasteActive: true,
      sunoPasteStyle: " pasted style ",
      sunoPasteLyrics: " pasted lyrics ",
    });
    expect(active.style).toBe("pasted style");
    expect(active.lyrics).toBe("pasted lyrics");
  });

  it("extractLyricsBodyFromPaste strips bracket header", () => {
    expect(extractLyricsBodyFromPaste("[Dark poetic]\nVerse line")).toBe("Verse line");
    expect(extractLyricsBodyFromPaste("Plain lyrics")).toBe("Plain lyrics");
  });

  it("hasSunoPasteContent and normalizePasteLine trim input", () => {
    expect(normalizePasteLine("  a\r\nb  ")).toBe("a\nb");
    expect(hasSunoPasteContent({ pastedStyle: "  ", pastedLyrics: "x" })).toBe(true);
    expect(hasSunoPasteContent({ pastedStyle: "", pastedLyrics: "" })).toBe(false);
  });
});
