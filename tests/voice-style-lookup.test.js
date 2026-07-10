import { describe, expect, it } from "vitest";
import { normalizeArtistVoiceProfile } from "../app/lib/voice-style-lookup.js";

describe("voice-style-lookup", () => {
  it("normalizeArtistVoiceProfile merges sources", () => {
    const profile = normalizeArtistVoiceProfile(
      {
        id: "mbid",
        name: "Freddie Mercury",
        gender: "male",
        genres: ["rock"],
        tags: ["glam rock"],
        externalUrl: "https://musicbrainz.org/artist/mbid",
        sources: ["musicbrainz"],
      },
      {
        spotifyGenres: ["classic rock", "glam rock"],
        wikipediaDescription: "British singer",
        wikipediaExtract: "Known for operatic tenor delivery and theatrical rock vocals.",
        sources: ["spotify", "wikipedia"],
      },
    );
    expect(profile.spotifyGenres).toContain("classic rock");
    expect(profile.sources).toEqual(expect.arrayContaining(["musicbrainz", "spotify", "wikipedia"]));
    expect(profile.wikipediaExtract).toContain("operatic");
  });
});
