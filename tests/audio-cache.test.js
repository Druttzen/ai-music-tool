import { describe, it, expect } from "vitest";
import {
  audioFileMatchesAnalysis,
  getAudioCacheKeysForAnalysis,
  makeAudioCacheKey,
  makeAudioLookupKey,
} from "../app/lib/audio-cache.js";

describe("audio-cache", () => {
  it("makeAudioCacheKey encodes name size and lastModified", () => {
    const file = { name: "track.mp3", size: 4096, lastModified: 12345 };
    expect(makeAudioCacheKey(file)).toBe("track.mp3|4096|12345");
  });

  it("makeAudioLookupKey normalizes file name and rounds duration", () => {
    expect(makeAudioLookupKey("My Track.WAV", 120.04)).toBe("lookup:my track.wav:1200");
  });

  it("getAudioCacheKeysForAnalysis dedupes lookup and cache keys", () => {
    const keys = getAudioCacheKeysForAnalysis({
      fileName: "beat.wav",
      duration: 180,
      audioCacheKey: "beat.wav|999|1",
      audioLookupKey: "lookup:beat.wav:1800",
    });
    expect(keys).toContain("beat.wav|999|1");
    expect(keys).toContain("lookup:beat.wav:1800");
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("audioFileMatchesAnalysis compares name and duration within tolerance", () => {
    const analysis = { fileName: "demo.mp3", duration: 120 };
    const file = { name: "demo.mp3" };
    expect(audioFileMatchesAnalysis(file, analysis, 121, 3)).toBe(true);
    expect(audioFileMatchesAnalysis(file, analysis, 130, 3)).toBe(false);
    expect(audioFileMatchesAnalysis({ name: "other.mp3" }, analysis, 120, 3)).toBe(false);
  });
});
