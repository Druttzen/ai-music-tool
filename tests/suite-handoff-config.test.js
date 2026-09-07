import { describe, expect, it } from "vitest";
import {
  canvasExecutableCandidates,
  expandPathTemplate,
  sanitizeArtworkExt,
  suiteDir,
} from "../lib/suite-handoff-config.cjs";

describe("suite-handoff-config", () => {
  it("suiteDir prefers STUDIO_DATA_DIR when set", () => {
    const prev = process.env.STUDIO_DATA_DIR;
    process.env.STUDIO_DATA_DIR = "C:/studio-data-fixture";
    try {
      const dir = suiteDir();
      expect(dir.replace(/\\/g, "/")).toMatch(/studio-data-fixture$/);
    } finally {
      if (prev === undefined) delete process.env.STUDIO_DATA_DIR;
      else process.env.STUDIO_DATA_DIR = prev;
    }
  });

  it("suiteDir falls back to temp suite when STUDIO_DATA_DIR is unset", () => {
    const prev = process.env.STUDIO_DATA_DIR;
    delete process.env.STUDIO_DATA_DIR;
    try {
      const dir = suiteDir();
      expect(dir.replace(/\\/g, "/")).toMatch(/ai-music-creator-studio-suite$/);
    } finally {
      if (prev === undefined) delete process.env.STUDIO_DATA_DIR;
      else process.env.STUDIO_DATA_DIR = prev;
    }
  });

  it("expandPathTemplate replaces HOME placeholder", () => {
    const home = process.env.HOME || process.env.USERPROFILE || "";
    const expanded = expandPathTemplate("$HOME/.local/bin/ai-canvas-tool");
    expect(expanded).toContain(home);
    expect(expanded).toContain(".local");
  });

  it("canvasExecutableCandidates stays inside Studio app data / app dir templates", () => {
    const candidates = canvasExecutableCandidates();
    expect(Array.isArray(candidates)).toBe(true);
    expect(candidates.length).toBeGreaterThan(0);
    const joined = candidates.join("\n").toLowerCase();
    expect(joined).not.toMatch(/program files/);
    expect(joined).not.toMatch(/localappdata[/\\]programs/);
  });

  it("sanitizeArtworkExt whitelists safe image extensions", () => {
    expect(sanitizeArtworkExt("jpg")).toBe("jpg");
    expect(sanitizeArtworkExt(".JPEG")).toBe("jpg");
    expect(sanitizeArtworkExt("webp")).toBe("webp");
    expect(sanitizeArtworkExt("GIF")).toBe("gif");
    expect(sanitizeArtworkExt("png")).toBe("png");
    expect(sanitizeArtworkExt("bmp")).toBe("png");
    expect(sanitizeArtworkExt(null)).toBe("png");
  });

  it("sanitizeArtworkExt rejects path separators and traversal", () => {
    expect(sanitizeArtworkExt("foo/../../evil")).toBe("png");
    expect(sanitizeArtworkExt("..\\evil")).toBe("png");
    expect(sanitizeArtworkExt("png/../../x")).toBe("png");
  });
});
