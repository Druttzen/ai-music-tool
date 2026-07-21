import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildCoverPromptFromStyle,
  resolveCoverPromptSource,
} from "../app/lib/cover-prompt.js";
import { coverInstallHint, coverRefInstallHint } from "../app/lib/sidecar-capabilities.js";
import { addonMeta, listAddonIds, musicVideoExportsDir } from "../lib/suite-handoff-config.cjs";
import { exportMusicVideoHandoff } from "../lib/suite-bridge.cjs";
import { MUSIC_VIDEO_ADDON, SUITE_ADDON_CATALOG } from "../app/lib/suite-addons-client.js";

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

describe("suite music video addon config", () => {
  it("lists musicVideo alongside canvas", () => {
    expect(listAddonIds()).toContain("canvas");
    expect(listAddonIds()).toContain("musicVideo");
    const meta = addonMeta("musicVideo");
    expect(meta.title).toMatch(/Glitchframe|Music Video/i);
    expect(meta.githubOwner).toBe("6Morpheus6");
    expect(SUITE_ADDON_CATALOG.map((a) => a.id)).toContain("musicVideo");
    expect(MUSIC_VIDEO_ADDON.installUrl).toContain("Glitchframe");
    expect(String(musicVideoExportsDir())).toMatch(/music-video/);
  });

  it("writes portable audio and cover assets into the handoff folder", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aimc-music-video-"));
    try {
      const result = await exportMusicVideoHandoff(
        {
          prompt: "neon industrial",
          audioBuffer: Uint8Array.from([1, 2, 3]),
          audioExt: "wav",
          coverBuffer: Uint8Array.from([4, 5, 6]),
          coverExt: "png",
        },
        { dir, openFolder: false },
      );
      const handoff = JSON.parse(fs.readFileSync(result.path, "utf8"));
      expect(fs.readFileSync(handoff.audioPath)).toEqual(Buffer.from([1, 2, 3]));
      expect(fs.readFileSync(handoff.coverPath)).toEqual(Buffer.from([4, 5, 6]));
      expect(path.dirname(handoff.audioPath)).toBe(dir);
      expect(path.dirname(handoff.coverPath)).toBe(dir);
      expect(handoff).not.toHaveProperty("audioUrl");
      expect(handoff).not.toHaveProperty("coverUrl");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
