import { describe, expect, it } from "vitest";
import {
  canvasExecutableCandidates,
  expandPathTemplate,
  sanitizeArtworkExt,
  suiteDir,
} from "../lib/suite-handoff-config.cjs";

describe("suite-handoff-config", () => {
  it("suiteDir uses Documents/AI Suite under home", () => {
    const dir = suiteDir();
    expect(dir.replace(/\\/g, "/")).toMatch(/Documents\/AI Suite$/);
  });

  it("expandPathTemplate replaces HOME placeholder", () => {
    const home = process.env.HOME || process.env.USERPROFILE || "";
    const expanded = expandPathTemplate("$HOME/.local/bin/ai-canvas-tool");
    expect(expanded).toContain(home);
    expect(expanded).toContain(".local");
  });

  it("canvasExecutableCandidates returns paths for current platform", () => {
    const candidates = canvasExecutableCandidates();
    expect(Array.isArray(candidates)).toBe(true);
    expect(candidates.length).toBeGreaterThan(0);
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
