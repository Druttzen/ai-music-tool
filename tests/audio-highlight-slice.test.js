import { describe, expect, it } from "vitest";
import { hasMeaningfulHighlightRange } from "../app/lib/audio-highlight-slice.js";

describe("hasMeaningfulHighlightRange", () => {
  it("detects a sub-range highlight", () => {
    expect(
      hasMeaningfulHighlightRange({ duration: 120, highlightStart: 30, highlightEnd: 45 }),
    ).toBe(true);
  });

  it("rejects full-track highlights", () => {
    expect(
      hasMeaningfulHighlightRange({ duration: 60, highlightStart: 0, highlightEnd: 59 }),
    ).toBe(false);
  });
});
