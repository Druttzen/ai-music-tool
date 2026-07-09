import { describe, expect, it } from "vitest";
import {
  formatMaestroCatalogGrounding,
  retrieveMaestroCatalogHints,
} from "../app/lib/maestro-catalog-grounding.js";

const SNAPSHOT = {
  idea: "dark warehouse techno night",
  tempo: "132 BPM",
  selectedGenres: ["Techno"],
  selectedRhythms: ["4/4"],
  selectedSounds: ["Heavy sub bass"],
  lyricTheme: "",
  lyricStyle: "",
  vocal: "Instrumental",
};

describe("maestro-catalog-grounding", () => {
  it("returns techno-related catalog hints for techno snapshot", () => {
    const hints = retrieveMaestroCatalogHints(SNAPSHOT, "make it darker and more industrial");
    expect(hints.length).toBeGreaterThan(0);
    expect(hints.some((hint) => /techno|industrial|bass/i.test(hint))).toBe(true);
  });

  it("formats grounding block for Maestro system prompt", () => {
    const block = formatMaestroCatalogGrounding(SNAPSHOT, "add acid techno flavor");
    expect(block).toContain("Licensed style catalog hints");
    expect(block).toContain("- ");
  });

  it("returns empty grounding when nothing matches", () => {
    const hints = retrieveMaestroCatalogHints(
      { idea: "xyzq", selectedGenres: [], selectedSounds: [], selectedRhythms: [] },
      "zzzz",
    );
    expect(hints).toEqual([]);
    expect(formatMaestroCatalogGrounding({ selectedGenres: [] }, "zzzz")).toBe("");
  });
});
