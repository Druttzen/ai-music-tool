import { describe, it, expect } from "vitest";
import { buildExportFileName } from "../app/lib/studio-export-client.js";

describe("buildExportFileName", () => {
  it("does not double-append enhanced suffix", () => {
    expect(buildExportFileName("track-highlight-streaming", "wav")).toBe(
      "track-highlight-streaming.wav",
    );
  });

  it("uses mp3 extension for mp3 format", () => {
    expect(buildExportFileName("song-enhanced-wide", "mp3")).toBe("song-enhanced-wide.mp3");
  });

  it("uses -24bit.wav suffix for wav24 format", () => {
    expect(buildExportFileName("track-enhanced-streaming", "wav24")).toBe(
      "track-enhanced-streaming-24bit.wav",
    );
  });
});
