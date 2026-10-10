import { cacheGeneratedAudioDraft } from "./generated-audio-cache";
import { resolveAudioCacheBlob } from "./audio-cache";

export async function cacheMusicGenDraftCandidates(result) {
  if (!result.search) return null;
  const candidates = [];
  for (const take of result.candidateFiles) {
    const { blob, ...metadata } = take;
    const fileName = `musicgen-take-${Date.now()}-${take.index}-seed-${take.seed}.wav`;
    const file = new File([blob], fileName, { type: "audio/wav" });
    candidates.push(await cacheGeneratedAudioDraft(file, { ...metadata, fileName, duration: result.durationSec }));
  }
  const warning = candidates.some(take => take.audioCacheWarning) ? " Some takes could not be stored locally; export them before closing." : "";
  return { ...result.search, candidates, note: result.search.note + warning };
}

export async function loadSavedMusicGenDraft(take, analysis) {
  const cached = await resolveAudioCacheBlob(take);
  if (!cached) throw new Error("This take is no longer in local storage. Generate or import it again.");
  return { blob: cached.blob, model: analysis.musicGenModel, durationSec: take.duration,
    mode: analysis.musicGenSettings?.mode ?? "text",
    search: { ...analysis.musicGenSearch, selected_index: take.index } };
}
