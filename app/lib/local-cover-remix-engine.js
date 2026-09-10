/**
 * Local cover/remix engine — reverse DNA + sidecar backends (no Suno).
 */

import {
  buildLocalTrackDna,
  resolveLocalCoverDurationSec,
  resolveLocalCoverRemixEngine,
} from "./local-track-dna";
import {
  hasMeaningfulHighlightRange,
  sliceAudioBlobToHighlightRange,
} from "./audio-highlight-slice";
import {
  fetchSidecarHealth,
  generateMusicWithMelodyViaSidecar,
  generateSongViaSidecar,
  transformVocalsViaSidecar,
  waitForSidecar,
} from "./sidecar-bridge";
import { isTauriApp } from "./dsp-bridge";

/**
 * @param {{
 *   mode?: "cover"|"remix",
 *   analysis: object,
 *   audioBlob: Blob,
 *   lyrics?: string,
 *   durationSec?: number|null,
 *   useHighlightMelody?: boolean,
 *   remixPitchSemitones?: number,
 *   attach?: boolean,
 *   download?: boolean,
 *   health?: object|null,
 * }} input
 * @returns {Promise<{
 *   blob: Blob,
 *   fileName: string,
 *   engine: string,
 *   mode: string,
 *   model: string|null,
 *   durationSec: number|null,
 *   dna: ReturnType<typeof buildLocalTrackDna>,
 *   reason: string,
 * }>}
 */
export async function runLocalCoverRemixJob(input) {
  const mode = input.mode === "remix" ? "remix" : "cover";
  const analysis = input.analysis;
  if (!analysis || typeof analysis !== "object") {
    throw new Error("Load a track in Analyzers first");
  }
  const audioBlob = input.audioBlob;
  if (!audioBlob) {
    throw new Error("No mix loaded — drop an audio file first");
  }

  const sidecarReady = await waitForSidecar(isTauriApp() ? 120_000 : 60_000);
  if (!sidecarReady) {
    throw new Error("Sidecar offline — start Studio sidecar or npm run sidecar");
  }

  const health = input.health ?? (await fetchSidecarHealth());
  const { engine, reason } = resolveLocalCoverRemixEngine(mode, health);
  if (!engine) {
    throw new Error(reason);
  }

  const dna = buildLocalTrackDna(analysis);
  const durationSec = resolveLocalCoverDurationSec(engine, input.durationSec, dna.durationSec);

  if (engine === "acestep") {
    const { blob, model, durationSec: dur } = await generateSongViaSidecar({
      prompt: dna.prompt,
      lyrics: String(input.lyrics || "").trim(),
      durationSec,
      bpm: dna.bpm,
      keyScale: dna.keyScale,
    });
    return {
      blob,
      fileName: `local-cover-acestep-${Date.now()}.wav`,
      engine,
      mode,
      model: model || "acestep",
      durationSec: dur || durationSec,
      dna,
      reason,
    };
  }

  if (engine === "musicgen-melody") {
    let melodyBlob = audioBlob;
    if (input.useHighlightMelody && hasMeaningfulHighlightRange(analysis)) {
      melodyBlob = await sliceAudioBlobToHighlightRange(
        audioBlob,
        analysis.highlightStart,
        analysis.highlightEnd,
        `highlight-${dna.fileName || "melody.wav"}`,
      );
    }
    const { blob, model, durationSec: dur } = await generateMusicWithMelodyViaSidecar(
      dna.prompt,
      durationSec ?? 12,
      melodyBlob,
      dna.fileName || "melody-reference.wav",
    );
    return {
      blob,
      fileName: `local-cover-melody-${Date.now()}.wav`,
      engine,
      mode,
      model: model || "musicgen-melody",
      durationSec: dur || durationSec,
      dna,
      reason,
    };
  }

  // remix via vocal-transform
  const pitch = Number(input.remixPitchSemitones);
  const pitchSemitones = Number.isFinite(pitch) ? pitch : 2;
  let regions = [];
  if (input.useHighlightMelody && hasMeaningfulHighlightRange(analysis)) {
    regions = [
      {
        start_sec: Number(analysis.highlightStart) || 0,
        end_sec: Number(analysis.highlightEnd) || 0,
      },
    ];
  }
  const { remixBlob, mode: xformMode } = await transformVocalsViaSidecar({
    file: audioBlob,
    fileName: dna.fileName || "mix.wav",
    mode: "pitch",
    regions,
    pitchSemitones,
    formantShift: pitchSemitones,
    output: "remix",
  });
  if (!remixBlob) {
    throw new Error("Vocal transform returned no remix");
  }
  return {
    blob: remixBlob,
    fileName: `local-remix-${Date.now()}.wav`,
    engine,
    mode,
    model: xformMode || "pitch",
    durationSec: dna.durationSec,
    dna,
    reason,
  };
}
