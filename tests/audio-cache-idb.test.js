import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import {
  getAudioCacheBlob,
  makeAudioCacheKey,
  putAudioCache,
  putAudioCacheEntries,
  resolveAudioCacheBlob,
} from "../app/lib/audio-cache.js";

describe("audio-cache indexeddb", () => {
  beforeEach(async () => {
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.deleteDatabase("ai-music-creator");
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      req.onblocked = () => resolve();
    });
    void db;
  });

  it("putAudioCache round-trips a blob by key", async () => {
    const file = new Blob(["audio-bytes"], { type: "audio/wav" });
    const key = makeAudioCacheKey({ name: "demo.wav", size: 11, lastModified: 1 });
    await putAudioCache(key, file);
    const blob = await getAudioCacheBlob(key);
    expect(blob).toBeTruthy();
    expect(await blob.text()).toBe("audio-bytes");
  });

  it("putAudioCacheEntries stores lookup and primary keys", async () => {
    const file = new File(["loop"], "loop.mp3", { type: "audio/mpeg" });
    const primary = makeAudioCacheKey({ name: "loop.mp3", size: 4, lastModified: 2 });
    const meta = await putAudioCacheEntries(file, primary, 180.2);
    expect(meta.audioCacheKey).toBe(primary);
    expect(meta.audioLookupKey).toContain("loop.mp3");

    const resolved = await resolveAudioCacheBlob({
      fileName: "loop.mp3",
      duration: 180.2,
      audioCacheKey: meta.audioCacheKey,
      audioLookupKey: meta.audioLookupKey,
    });
    expect(resolved?.matchedKey).toBeTruthy();
    expect(await resolved.blob.text()).toBe("loop");
  });
});
