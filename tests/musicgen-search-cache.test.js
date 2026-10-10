import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { cacheMusicGenDraftCandidates, loadSavedMusicGenDraft } from "../app/lib/musicgen-draft-search";
import { migratePersistedProject, slimAudioAnalysisForStorage } from "../app/lib/project-persistence";

it("keeps every take playable from serialized metadata and never needs another generation", async () => {
  const result = { durationSec: 30, search: { selected_index: 1, ranked: true, note: "style only" },
    candidateFiles: [0, 1, 2].map(index => ({ index, seed: index + 123, score: 0.1 * index,
      blob: new Blob([`audio-${index}`], { type: "audio/wav" }) })) };
  const search = await cacheMusicGenDraftCandidates(result);
  const stored = JSON.parse(JSON.stringify(slimAudioAnalysisForStorage({ musicGenModel: "stereo-small",
    musicGenSearch: search, musicGenSettings: { mode: "text" } })));
  const analysis = migratePersistedProject({ audioAnalysis: stored, appVersion: "0.50.51" }, "0.50.53").audioAnalysis;
  expect(analysis.musicGenSearch.selected_index).toBe(1);
  for (const take of analysis.musicGenSearch.candidates) {
    const restored = await loadSavedMusicGenDraft(take, analysis);
    expect(await restored.blob.text()).toBe(`audio-${take.index}`);
    expect(restored.search.selected_index).toBe(take.index);
  }
});

it("reports missing cached audio instead of silently regenerating a take", async () => {
  await expect(loadSavedMusicGenDraft({ audioCacheKey: "missing" }, {})).rejects.toThrow("no longer in local storage");
});
