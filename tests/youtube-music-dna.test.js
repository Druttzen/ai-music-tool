import { describe, expect, it } from "vitest";
import {
  buildSunoReplicationPack,
  inferSunoStructureFromDuration,
  parseYoutubeMusicTitle,
} from "../app/lib/youtube-music-dna.js";
import { normalizeYoutubeResolvePayload } from "../app/lib/youtube-reference.js";

describe("youtube-music-dna", () => {
  it("parseYoutubeMusicTitle splits artist and track", () => {
    expect(parseYoutubeMusicTitle("Daft Punk - Harder Better Faster Stronger (Official Video)")).toEqual({
      artist: "Daft Punk",
      track: "Harder Better Faster Stronger",
      searchQuery: "Daft Punk Harder Better Faster Stronger",
    });
  });

  it("buildSunoReplicationPack includes tempo genres and vocal stack", () => {
    const pack = buildSunoReplicationPack(
      {
        artist: "Daft Punk",
        title: "Harder Better Faster Stronger",
        genres: ["House", "Electronic"],
        sounds: ["Analog synths"],
        rhythms: ["4/4"],
        tempo: "128 BPM",
        estimatedKey: "F minor",
        moodWords: ["danceable", "high-energy"],
        featureSummary: "dance 0.82, energy 0.88",
        vocalRole: "Male Lead",
      },
      { durationSec: 220 },
    );
    expect(pack.styleLine).toMatch(/128 BPM/);
    expect(pack.styleLine).toMatch(/House/);
    expect(pack.structure).toContain("bridge");
    expect(pack.ideaLine).toContain("Daft Punk");
  });

  it("inferSunoStructureFromDuration scales with track length", () => {
    expect(inferSunoStructureFromDuration(95)).toContain("bridge");
    expect(inferSunoStructureFromDuration(40)).not.toContain("bridge");
  });
});

describe("youtube-reference normalize", () => {
  it("normalizeYoutubeResolvePayload maps sidecar fields", () => {
    const out = normalizeYoutubeResolvePayload({
      video_id: "abc12345678",
      watch_url: "https://www.youtube.com/watch?v=abc12345678",
      title: "Artist - Song",
      author_name: "Channel",
      parsed_artist: "Artist",
      parsed_track: "Song",
      search_query: "Artist Song",
      duration_sec: 200,
      provider: "oembed",
    });
    expect(out?.videoId).toBe("abc12345678");
    expect(out?.parsedArtist).toBe("Artist");
    expect(out?.searchQuery).toBe("Artist Song");
  });
});
