import { describe, it, expect } from "vitest";
import {
  formatTempoWithDescriptor,
  tempoAlreadyHasDescriptor,
  tempoDescriptorForBpm,
} from "../app/lib/tempo-descriptors.js";
import { selectNegativeGuards, INSTRUMENTAL_LYRICS_SCAFFOLD } from "../app/lib/suno-negative-guards.js";
import { generateMetaphorStyle, metaphorToCatalogHints } from "../app/lib/metaphor-style.js";
import { eraAnchoredGenres, trendMicroGenres2026 } from "../app/lib/style-catalog-extensions.js";

describe("tempo-descriptors", () => {
  it("adds evocative adjective to numeric BPM", () => {
    expect(formatTempoWithDescriptor("128 BPM")).toContain("energetic");
    expect(formatTempoWithDescriptor(60)).toContain("slow");
  });

  it("detects when descriptor already present", () => {
    expect(tempoAlreadyHasDescriptor("128 BPM, driving and upbeat")).toBe(true);
    expect(tempoAlreadyHasDescriptor("128 BPM")).toBe(false);
  });

  it("maps BPM ranges to descriptors", () => {
    expect(tempoDescriptorForBpm(65)).toContain("slow");
    expect(tempoDescriptorForBpm(175)).toContain("fast");
  });
});

describe("suno-negative-guards", () => {
  it("selects instrumental guard pack", () => {
    const guards = selectNegativeGuards({ vocal: "Instrumental", max: 3 });
    expect(guards).toContain("no vocals");
    expect(guards.length).toBeLessThanOrEqual(3);
  });

  it("includes intro vocal guards from rules", () => {
    const guards = selectNegativeGuards({ rules: "no intro hum please", max: 4 });
    expect(guards.some((g) => g.includes("hum") || g.includes("intro"))).toBe(true);
  });

  it("exports instrumental lyric scaffold with dual tags", () => {
    expect(INSTRUMENTAL_LYRICS_SCAFFOLD).toContain("[Instrumental]");
    expect(INSTRUMENTAL_LYRICS_SCAFFOLD).toContain("[No Vocals]");
  });
});

describe("metaphor-style", () => {
  it("generates five-slot style line", () => {
    const metaphor = generateMetaphorStyle(() => 0.1);
    expect(metaphor.slots).toHaveLength(5);
    expect(metaphor.styleLine.split(", ").length).toBe(5);
  });

  it("maps metaphor to catalog genre hints", () => {
    const hints = metaphorToCatalogHints({
      slots: ["industrial techno", "whispered mantras", "sub-heavy 808s", "warehouse grit", "tension release"],
    });
    expect(hints.genres).toContain("Techno");
  });
});

describe("style-catalog-extensions", () => {
  it("includes era anchors and 2026 trend micro-genres", () => {
    expect(eraAnchoredGenres.length).toBeGreaterThanOrEqual(8);
    expect(trendMicroGenres2026.some((line) => /phonk|pluggnb|garage/i.test(line))).toBe(true);
  });
});
