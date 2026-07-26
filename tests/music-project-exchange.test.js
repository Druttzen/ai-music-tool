import { describe, expect, it } from "vitest";
import {
  MUSIC_EXCHANGE_CONTRACT,
  MUSIC_EXCHANGE_INTENTS,
  buildMusicProjectExchangeBlock,
  resolveMusicExchangeIntent,
  slugifyMusicExchangeBaseName,
} from "../app/lib/music-project-exchange.js";
import { buildProjectBundleExport } from "../app/lib/project-bundle.js";

describe("music-project-exchange", () => {
  it("describes the available music assets without naming a consumer", () => {
    expect(resolveMusicExchangeIntent({ audioAnalysis: { bpm: 120 }, imageAnalysis: {} })).toBe(
      MUSIC_EXCHANGE_INTENTS.TRACK_WITH_ARTWORK,
    );
    expect(resolveMusicExchangeIntent({ audioAnalysis: { bpm: 120 } })).toBe(
      MUSIC_EXCHANGE_INTENTS.TRACK,
    );
    expect(resolveMusicExchangeIntent({})).toBe(MUSIC_EXCHANGE_INTENTS.PROJECT_ONLY);
  });

  it("attaches a portable compatibility block without consumer settings", () => {
    const handoff = buildMusicProjectExchangeBlock({
      appVersion: "1.0.0",
      audioAnalysis: { durationSec: 45 },
    });
    const bundle = buildProjectBundleExport({ idea: "test" }, {}, "1.0.0", {
      handoff,
      bundleVersion: 2,
    });
    expect(bundle.bundleVersion).toBe(2);
    expect(bundle.handoff?.source).toBe("ai-music-creator");
    expect(bundle.handoff?.contract).toBe(MUSIC_EXCHANGE_CONTRACT);
    expect(bundle).not.toHaveProperty("directorSettings");
  });

  it("creates a neutral, safe filename base", () => {
    expect(slugifyMusicExchangeBaseName("Neon Alley!!!")).toMatch(/neon-alley/i);
    expect(slugifyMusicExchangeBaseName("")).toBe("music-project");
  });
});
