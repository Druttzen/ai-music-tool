import { describe, expect, it } from "vitest";
import {
  buildProjectBundleExport,
  parseProjectBundleImport,
  summarizeProjectBundle,
} from "../app/lib/project-bundle.js";
import {
  buildVocalEmbedBundleSession,
} from "../app/lib/vocal-embed-handoff.js";

describe("project bundle vocal embed", () => {
  it("round-trips vocal align preview in bundle export", () => {
    const session = buildVocalEmbedBundleSession(
      { align_method: "heuristic", word_count: 4, sections: [] },
      "track.wav",
      "guide.wav",
      { format: "openvpi-ds-segments", segment_count: 1, segments: [{ text: "hi" }] },
    );
    const bundle = buildProjectBundleExport({ idea: "test" }, {}, "0.22.0", {
      vocalEmbed: session,
    });
    const parsed = parseProjectBundleImport(bundle);
    expect(parsed.vocalEmbed?.preview?.align_method).toBe("heuristic");
    expect(parsed.vocalEmbed?.instrumentalName).toBe("track.wav");
    expect(parsed.vocalEmbed?.openvpiDs?.segment_count).toBe(1);
    const summary = summarizeProjectBundle(bundle);
    expect(summary.hasVocalAlign).toBe(true);
    expect(summary.hasOpenvpiDs).toBe(true);
  });
});
