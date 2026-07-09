import { describe, expect, it } from "vitest";
import {
  AWESOME_SUNO_CONCEPTS_SYNC,
  awesomeSunoConceptLines,
  awesomeSunoConceptTags,
} from "../app/lib/awesome-suno-concepts-synced.js";

describe("awesome-suno-concepts-synced", () => {
  it("exports a capped CC0 catalog with tags", () => {
    expect(AWESOME_SUNO_CONCEPTS_SYNC.conceptCap).toBe(400);
    expect(awesomeSunoConceptLines.length).toBeGreaterThan(0);
    expect(awesomeSunoConceptLines.length).toBeLessThanOrEqual(400);
    expect(Object.keys(awesomeSunoConceptTags).length).toBe(awesomeSunoConceptLines.length);
    for (const line of awesomeSunoConceptLines) {
      expect(line.length).toBeGreaterThanOrEqual(24);
      expect(line.length).toBeLessThanOrEqual(280);
      expect(awesomeSunoConceptTags[line]).toBeTruthy();
    }
  });

  it("records rotation metadata when present", () => {
    if (AWESOME_SUNO_CONCEPTS_SYNC.rotationOffset != null) {
      expect(Number(AWESOME_SUNO_CONCEPTS_SYNC.rotationOffset)).toBeGreaterThanOrEqual(0);
    }
    if (AWESOME_SUNO_CONCEPTS_SYNC.poolSize != null) {
      expect(AWESOME_SUNO_CONCEPTS_SYNC.poolSize).toBeGreaterThanOrEqual(awesomeSunoConceptLines.length);
    }
  });
});
