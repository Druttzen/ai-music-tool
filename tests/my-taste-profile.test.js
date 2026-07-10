/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from "vitest";
import {
  buildMyTasteProfile,
  trackSummariesFromWorkspace,
} from "../app/lib/my-taste-profile.js";
import { loadStyleDnaSettings, saveStyleDnaSettings } from "../app/lib/style-dna-settings.js";

describe("my-taste-profile", () => {
  it("builds magic style line from history snapshots", () => {
    const profile = buildMyTasteProfile({
      current: {
        selectedGenres: ["Synth Pop", "Pop"],
        tempo: "118 BPM",
        vocal: "Female Lead",
        mood: { darkness: 40, energy: 70, aggression: 30, emotion: 60, complexity: 50, space: 55 },
      },
      history: [
        {
          state: {
            selectedGenres: ["Synth Pop"],
            tempo: "120 BPM",
            vocal: "Female Lead",
            mood: { darkness: 35, energy: 75, aggression: 25, emotion: 55, complexity: 45, space: 50 },
          },
        },
      ],
    });
    expect(profile.ready).toBe(true);
    expect(profile.topGenres[0]).toMatch(/Synth Pop/i);
    expect(profile.magicStyleLine).toMatch(/BPM/);
    expect(profile.magicStyleLine).toMatch(/Female Lead/i);
  });

  it("dedupes track summaries for custom model pack input", () => {
    const tracks = trackSummariesFromWorkspace(
      { idea: "Track A", tempo: "120 BPM", selectedGenres: ["Pop"] },
      [{ label: "Track A", state: { tempo: "118 BPM", selectedGenres: ["Pop"] } }],
    );
    expect(tracks).toHaveLength(1);
    expect(tracks[0].title).toBe("Track A");
  });
});

describe("style-dna-settings audd", () => {
  it("persists auddApiToken in localStorage", () => {
    const key = "ai_music_creator_style_dna_v1";
    localStorage.removeItem(key);
    saveStyleDnaSettings({ spotifyClientId: "a", spotifyClientSecret: "b", auddApiToken: "tok123" });
    const loaded = loadStyleDnaSettings();
    expect(loaded.auddApiToken).toBe("tok123");
    localStorage.removeItem(key);
  });
});
