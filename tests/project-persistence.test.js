import { describe, it, expect } from "vitest";
import { slimStateForUndo } from "../app/lib/project-persistence.js";

describe("slimStateForUndo", () => {
  it("includes guided step, variations, and history", () => {
    const peaks = new Array(100).fill(0.5);
    const out = slimStateForUndo({
      idea: "test",
      guidedStep: 3,
      variations: [{ id: 1, title: "V1" }],
      history: [{ id: 2, label: "snap" }],
      selectedHistoryId: 2,
      audioAnalysis: { fileName: "a.wav", waveformPeaks: peaks },
    });
    expect(out.guidedStep).toBe(3);
    expect(out.variations).toHaveLength(1);
    expect(out.history).toHaveLength(1);
    expect(out.selectedHistoryId).toBe(2);
    expect(out.audioAnalysis.waveformPeaks).toBeUndefined();
  });
});
