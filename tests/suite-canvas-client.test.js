/**
 * @jest-environment node
 */
import { describe, expect, it } from "vitest";
import {
  deriveCanvasMotionHint,
  deriveCanvasTrackMeta,
} from "../app/lib/suite-canvas-client.js";

describe("suite-canvas-client", () => {
  it("deriveCanvasTrackMeta prefers audio file name", () => {
    const meta = deriveCanvasTrackMeta({
      idea: "dark bass track",
      audioAnalysis: { fileName: "my-song.wav" },
    });
    expect(meta.title).toBe("my-song");
    expect(meta.artist).toBe("dark bass track");
  });

  it("deriveCanvasMotionHint uses image visual mood", () => {
    expect(deriveCanvasMotionHint({ visualMood: "neon" })).toContain("neon");
  });
});
