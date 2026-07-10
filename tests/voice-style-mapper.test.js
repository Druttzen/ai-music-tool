import { describe, expect, it } from "vitest";
import {
  buildSunoVoiceStyleFromProfile,
  genderToVocalCharacter,
  summarizeArtistVoiceProfile,
} from "../app/lib/voice-style-mapper.js";
import { presetToVoiceProfile, FAMOUS_VOICE_PRESETS } from "../app/lib/suno-voice-style.js";

describe("voice-style-mapper", () => {
  it("maps Whitney Houston seed to soul/pop vocal tokens", () => {
    const profile = presetToVoiceProfile(FAMOUS_VOICE_PRESETS[0]);
    const built = buildSunoVoiceStyleFromProfile(profile, { referenceName: "Whitney Houston" });
    expect(built.style.toLowerCase()).toMatch(/soul|female|gospel|pop|r&b/);
    expect(built.style).not.toMatch(/Whitney Houston-inspired vocal energy/);
    expect(built.lyricTag).toContain("Whitney Houston");
    expect(built.voiceStyleLine.length).toBeGreaterThan(20);
  });

  it("maps Frank Sinatra seed to jazz/crooner tokens", () => {
    const preset = FAMOUS_VOICE_PRESETS.find((p) => p.first === "Frank");
    const built = buildSunoVoiceStyleFromProfile(presetToVoiceProfile(preset), {
      referenceName: "Frank Sinatra",
    });
    expect(built.style.toLowerCase()).toMatch(/jazz|crooner|swing|male/);
  });

  it("uses MusicBrainz gender for character fallback", () => {
    expect(genderToVocalCharacter("female")).toBe("female lead vocal");
    expect(genderToVocalCharacter("male")).toBe("male lead vocal");
  });

  it("summarizes profile for search results", () => {
    const summary = summarizeArtistVoiceProfile({
      displayName: "Adele",
      gender: "female",
      genres: ["soul", "pop"],
      tags: [],
      spotifyGenres: [],
      country: "GB",
    });
    expect(summary).toContain("Adele");
    expect(summary).toContain("soul");
  });

  it("all famous presets have profile seeds with genres", () => {
    for (const preset of FAMOUS_VOICE_PRESETS) {
      expect(preset.profileSeed?.genres?.length).toBeGreaterThan(0);
      expect(preset.searchName).toBeTruthy();
    }
  });
});
