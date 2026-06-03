import { describe, it, expect } from "vitest";
import { normalizeStudioExportFormat } from "../app/lib/audio-export-formats.js";

describe("normalizeStudioExportFormat", () => {
  it("accepts wav and mp3", () => {
    expect(normalizeStudioExportFormat("wav")).toBe("wav");
    expect(normalizeStudioExportFormat("mp3")).toBe("mp3");
  });

  it("maps legacy flac aliases to wav", () => {
    expect(normalizeStudioExportFormat("flac")).toBe("wav");
    expect(normalizeStudioExportFormat("wav-lossless")).toBe("wav");
    expect(normalizeStudioExportFormat("lossless")).toBe("wav");
  });

  it("accepts wav24", () => {
    expect(normalizeStudioExportFormat("wav24")).toBe("wav24");
    expect(normalizeStudioExportFormat("24bit")).toBe("wav24");
  });

  it("defaults unknown values to wav", () => {
    expect(normalizeStudioExportFormat(undefined)).toBe("wav");
    expect(normalizeStudioExportFormat("ogg")).toBe("wav");
  });
});
