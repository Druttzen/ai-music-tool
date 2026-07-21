import { describe, expect, it } from "vitest";
import {
  buildCoverPromptFromStyle,
  resolveCoverPromptSource,
} from "../app/lib/cover-prompt.js";
import { coverInstallHint, coverRefInstallHint } from "../app/lib/sidecar-capabilities.js";

describe("cover-prompt", () => {
  it("appends album-cover suffix and trims analyzer prefixes", () => {
    const out = buildCoverPromptFromStyle("IMAGE: dark │ Techno, neon", { maxLen: 200 });
    expect(out.toLowerCase()).toContain("album cover");
    expect(out.toLowerCase()).not.toMatch(/\bimage:/i);
    expect(out.length).toBeLessThanOrEqual(200);
  });

  it("resolveCoverPromptSource prefers paste Style", () => {
    expect(
      resolveCoverPromptSource({
        sunoPasteStyle: "Ambient, ethereal",
        idea: "fallback",
      }),
    ).toBe("Ambient, ethereal");
  });
});

describe("cover install hints", () => {
  it("returns npm scripts for missing cover extras", () => {
    expect(coverInstallHint({ cover_available: false })).toBe("npm run sidecar:cover");
    expect(coverRefInstallHint({ cover_ref_available: false })).toBe("npm run sidecar:cover-ref");
  });
});
