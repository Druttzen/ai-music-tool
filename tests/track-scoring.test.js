import { describe, expect, it } from "vitest";
import {
  computeAvgScore,
  formatScoreSummary,
  scoreAdvisoryLines,
  scorePromptHints,
} from "../app/lib/track-scoring.js";
import { buildSunoPastedStyleLine } from "../app/lib/suno-guided-workflow.js";

describe("track-scoring", () => {
  it("computes average score across dimensions", () => {
    expect(computeAvgScore({ bass: 4, rhythm: 4, identity: 4, clarity: 4 })).toBe(4);
    expect(computeAvgScore(null)).toBe(0);
  });

  it("emits production hints for weak dimensions", () => {
    const hints = scorePromptHints({ bass: 2, rhythm: 5, identity: 2, clarity: 5 });
    expect(hints.some((h) => /sub foundation/i.test(h))).toBe(true);
    expect(hints.some((h) => /signature/i.test(h))).toBe(true);
  });

  it("adds advisory lines for co-producer report", () => {
    const lines = scoreAdvisoryLines({ bass: 2, rhythm: 2, identity: 5, clarity: 5 });
    expect(lines.length).toBe(2);
    expect(lines[0]).toMatch(/Low-end score/i);
  });

  it("formats score summary for reports", () => {
    expect(formatScoreSummary({ bass: 2, rhythm: 5, identity: 5, clarity: 5 })).toMatch(
      /boost bass/i,
    );
  });

  it("injects score hints into Suno style paste line", () => {
    const withHints = buildSunoPastedStyleLine({
      selectedGenres: ["Techno"],
      tempo: "130 BPM",
      vocal: "Instrumental",
      scores: { bass: 2, rhythm: 5, identity: 5, clarity: 5 },
    });
    expect(withHints).toMatch(/sub foundation/i);
  });
});
