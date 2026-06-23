import { describe, it, expect } from "vitest";
import {
  HANDOFF_INTENTS,
  buildVideoCreatorDirectorSettings,
  buildVideoCreatorHandoffBlock,
  resolveHandoffIntent,
  slugifyHandoffBaseName,
} from "../app/lib/video-creator-handoff.js";
import { buildProjectBundleExport } from "../app/lib/project-bundle.js";

describe("video-creator-handoff", () => {
  it("resolveHandoffIntent picks Path E when audio and image present", () => {
    expect(resolveHandoffIntent({ audioAnalysis: { bpm: 120 }, imageAnalysis: {} })).toBe(
      HANDOFF_INTENTS.MUSIC_VIDEO_PATH_E,
    );
    expect(resolveHandoffIntent({ audioAnalysis: { bpm: 120 } })).toBe(
      HANDOFF_INTENTS.MUSIC_VIDEO_TRACK,
    );
    expect(resolveHandoffIntent({})).toBe(HANDOFF_INTENTS.PROJECT_ONLY);
  });

  it("buildProjectBundleExport attaches handoff v2", () => {
    const handoff = buildVideoCreatorHandoffBlock({
      appVersion: "1.0.0",
      audioAnalysis: { durationSec: 45 },
    });
    const bundle = buildProjectBundleExport({ idea: "test" }, {}, "1.0.0", {
      handoff,
      directorSettings: buildVideoCreatorDirectorSettings({ audioAnalysis: { durationSec: 45 } }),
      bundleVersion: 2,
    });
    expect(bundle.bundleVersion).toBe(2);
    expect(bundle.handoff?.source).toBe("ai-music-creator");
    expect(bundle.directorSettings?.localRenderEngine).toBe("diffusers-wan");
  });

  it("slugifyHandoffBaseName sanitizes idea", () => {
    expect(slugifyHandoffBaseName("Neon Alley!!!")).toMatch(/neon-alley/i);
  });
});
