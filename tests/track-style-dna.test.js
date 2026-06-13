import { describe, it, expect } from "vitest";
import { parseSpotifyTrackUrl } from "../app/lib/spotify-style-dna.js";
import {
  buildStyleDnaFromHit,
  buildStyleDnaStyleTokens,
  formatSpotifyKey,
  mapSpotifyFeaturesToMood,
} from "../app/lib/track-style-dna.js";

describe("track-style-dna", () => {
  it("parseSpotifyTrackUrl extracts track id", () => {
    expect(parseSpotifyTrackUrl("https://open.spotify.com/track/11dFghVXANMlKmJXsNCbNl")).toBe(
      "11dFghVXANMlKmJXsNCbNl",
    );
  });

  it("formatSpotifyKey maps pitch class and mode", () => {
    expect(formatSpotifyKey(0, 1)).toBe("C major");
    expect(formatSpotifyKey(9, 0)).toBe("A minor");
  });

  it("mapSpotifyFeaturesToMood scales 0-1 features to sliders", () => {
    const mood = mapSpotifyFeaturesToMood({
      energy: 0.9,
      valence: 0.2,
      danceability: 0.8,
      acousticness: 0.1,
      liveness: 0.3,
      speechiness: 0.05,
      instrumentalness: 0.1,
    });
    expect(mood?.energy).toBe(90);
    expect(mood?.darkness).toBeGreaterThan(50);
  });

  it("buildStyleDnaFromHit maps Spotify hit to Suno tokens", () => {
    const dna = buildStyleDnaFromHit({
      source: "spotify",
      id: "x",
      title: "Harder Better Faster",
      artist: "Daft Punk",
      album: "Discovery",
      artistGenres: ["french house", "electronic"],
      features: {
        tempo: 123.4,
        energy: 0.88,
        valence: 0.55,
        danceability: 0.82,
        acousticness: 0.02,
        instrumentalness: 0.91,
        speechiness: 0.05,
        liveness: 0.12,
        key: 2,
        mode: 1,
        time_signature: 4,
      },
    });
    expect(dna.tempo).toBe("123 BPM");
    expect(dna.estimatedKey).toBe("D major");
    expect(dna.vocalRole).toBe("Instrumental");
    expect(dna.styleTokens).toMatch(/123 BPM/);
    expect(buildStyleDnaStyleTokens(dna).length).toBeGreaterThan(20);
  });
});
