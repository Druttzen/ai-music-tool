import { describe, expect, it } from "vitest";
import { buildWaveformRegionSpecs } from "../app/components/audio-waveform-pro-prototype.jsx";

describe("buildWaveformRegionSpecs", () => {
  it("always includes highlight and extras from vocalRegions", () => {
    const specs = buildWaveformRegionSpecs({
      duration: 60,
      highlightStart: 10,
      highlightEnd: 18,
      vocalRegions: [
        { id: "region-1", start: 30, end: 36 },
        { id: "highlight", start: 0, end: 1 },
      ],
    });
    expect(specs[0].id).toBe("highlight");
    expect(specs[0].start).toBe(10);
    expect(specs.some((s) => s.id === "region-1")).toBe(true);
    expect(specs.filter((s) => s.id === "highlight")).toHaveLength(1);
  });
});
