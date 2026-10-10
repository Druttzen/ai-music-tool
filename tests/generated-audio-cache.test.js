import "fake-indexeddb/auto";
import { afterEach, expect, it, vi } from "vitest";
import { cacheGeneratedAudioDraft } from "../app/lib/generated-audio-cache";
import { resolveAudioCacheBlob } from "../app/lib/audio-cache";

afterEach(() => vi.unstubAllGlobals());

it("restores a generated draft from persisted analysis without its temporary player URL", async () => {
  const file = new File(["original generated audio"], "generated.wav", { type: "audio/wav" });
  const report = await cacheGeneratedAudioDraft(file, { duration: 30, fileName: file.name, sourceEngine: "musicgen", musicGenSettings: { seed: 123 } });
  const restored = await resolveAudioCacheBlob(JSON.parse(JSON.stringify(report)));
  expect(await restored.blob.text()).toBe("original generated audio");
  expect(report.musicGenSettings.seed).toBe(123);
  expect(report.fileSize).toBe(file.size);
});

it("keeps the generated result and reports a storage failure", async () => {
  vi.stubGlobal("indexedDB", undefined);
  const file = new File(["generated audio"], "generated.wav");
  const report = await cacheGeneratedAudioDraft(file, { duration: 5, sourceEngine: "acestep" });
  expect(report.sourceEngine).toBe("acestep");
  expect(report.audioCacheWarning).toContain("Export the audio before closing");
  expect(report.audioCacheKey).toBeUndefined();
});
