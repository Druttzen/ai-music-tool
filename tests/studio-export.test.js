import { describe, it, expect } from "vitest";
import { buildExportFileName } from "../app/lib/studio-export-client.js";
import { normalizeStudioExportFormat } from "../app/lib/audio-export-formats.js";

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
  it("uses flac and wav32 filenames", () => {
    expect(buildExportFileName("song-enhanced-streaming", "flac")).toBe(
      "song-enhanced-streaming.flac",
    );
    expect(buildExportFileName("song-enhanced-streaming", "wav32")).toBe(
      "song-enhanced-streaming-32float.wav",
    );
  });
  it("uses m4a extension for Apple AAC delivery", () => {
    expect(buildExportFileName("song-enhanced-streaming", "m4a")).toBe(
      "song-enhanced-streaming.m4a",
    );
    expect(buildExportFileName("song-enhanced-streaming", "aac")).toBe(
      "song-enhanced-streaming.m4a",
    );
  });
});

describe("studio export format normalization", () => {
  it("normalizes aliases used by the export UI", () => {
    expect(normalizeStudioExportFormat("wav")).toBe("wav");
    expect(normalizeStudioExportFormat("wav24")).toBe("wav24");
    expect(normalizeStudioExportFormat("wav32")).toBe("wav32");
    expect(normalizeStudioExportFormat("flac")).toBe("flac");
    expect(normalizeStudioExportFormat("m4a")).toBe("m4a");
    expect(normalizeStudioExportFormat("mp3")).toBe("mp3");
    expect(normalizeStudioExportFormat("WAV24")).toBe("wav24");
  });

  it("buildExportFileName stays aligned with normalized formats", () => {
    for (const fmt of ["wav", "wav24", "wav32", "flac", "m4a", "mp3"]) {
      const normalized = normalizeStudioExportFormat(fmt);
      const name = buildExportFileName("export-test", normalized);
      expect(name).toMatch(/\.(wav|mp3|flac|m4a)$/);
    }
  });
});
