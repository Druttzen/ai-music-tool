import { describe, it, expect } from "vitest";
import { normalizeStudioExportFormat } from "../app/lib/audio-export-formats.js";

describe("normalizeStudioExportFormat", () => {
  it("accepts wav and mp3", () => {
    expect(normalizeStudioExportFormat("wav")).toBe("wav");
    expect(normalizeStudioExportFormat("mp3")).toBe("mp3");
  });

  it("maps lossless aliases to real flac", () => {
    expect(normalizeStudioExportFormat("flac")).toBe("flac");
    expect(normalizeStudioExportFormat("wav-lossless")).toBe("flac");
    expect(normalizeStudioExportFormat("lossless")).toBe("flac");
  });

  it("accepts wav24 and wav32", () => {
    expect(normalizeStudioExportFormat("wav24")).toBe("wav24");
    expect(normalizeStudioExportFormat("24bit")).toBe("wav24");
    expect(normalizeStudioExportFormat("wav32")).toBe("wav32");
    expect(normalizeStudioExportFormat("float")).toBe("wav32");
  });

  it("defaults unknown values to wav", () => {
    expect(normalizeStudioExportFormat(undefined)).toBe("wav");
    expect(normalizeStudioExportFormat("ogg")).toBe("wav");
  });
});
