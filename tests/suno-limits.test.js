import { describe, it, expect } from "vitest";
import {
  SUNO_STYLE_CHAR_CAP,
  SUNO_LYRICS_CHAR_TYPICAL_MAX,
  validateSunoFieldLengths,
} from "../app/lib/suno-limits.js";

describe("validateSunoFieldLengths", () => {
  it("warns when style exceeds cap", () => {
    const w = validateSunoFieldLengths(SUNO_STYLE_CHAR_CAP + 1, 100);
    expect(w.some((x) => x.includes("Style box"))).toBe(true);
  });

  it("warns when lyrics exceed typical max", () => {
    const w = validateSunoFieldLengths(500, SUNO_LYRICS_CHAR_TYPICAL_MAX + 1);
    expect(w.some((x) => x.includes("Lyrics"))).toBe(true);
  });

  it("returns empty when within limits", () => {
    expect(validateSunoFieldLengths(400, 400)).toEqual([]);
  });
});
