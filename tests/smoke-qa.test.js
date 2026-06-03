import { describe, it, expect } from "vitest";
import { slimStateForUndo } from "../app/lib/project-persistence.js";
import { normalizeStudioExportFormat } from "../app/lib/audio-export-formats.js";
import { buildExportFileName } from "../app/lib/studio-export-client.js";

/**
 * Automated smoke checks mirroring manual QA (undo + export formats).
 */
describe("smoke QA flows", () => {
  it("undo snapshot round-trip preserves preset fields", () => {
    const before = {
      idea: "dark underground bass track with mechanical energy",
      tempo: "130 BPM",
      guidedStep: 2,
      variations: [],
      history: [],
      selectedHistoryId: null,
    };
    const afterPreset = {
      ...before,
      idea: "jungle pressure with sub-heavy breaks",
      tempo: "174 BPM",
      selectedGenres: ["Jungle", "Drum & Bass"],
    };
    const snap = slimStateForUndo(before);
    expect(JSON.parse(JSON.stringify(snap)).idea).toBe(before.idea);
    expect(JSON.parse(JSON.stringify(snap)).tempo).toBe("130 BPM");
    expect(afterPreset.idea).not.toBe(before.idea);
    const restored = JSON.parse(JSON.stringify(snap));
    expect(restored.idea).toBe(before.idea);
    expect(restored.tempo).toBe("130 BPM");
  });

  it("studio export formats produce expected filenames", () => {
    const base = "smoke-test-tone-enhanced-streaming";
    expect(buildExportFileName(base, normalizeStudioExportFormat("wav"))).toBe(`${base}.wav`);
    expect(buildExportFileName(base, normalizeStudioExportFormat("wav24"))).toBe(`${base}-24bit.wav`);
    expect(buildExportFileName(base, normalizeStudioExportFormat("mp3"))).toBe(`${base}.mp3`);
  });
});
