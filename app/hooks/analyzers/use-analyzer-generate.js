"use client";

import { advanceAnalyzerEpoch } from "../../lib/analyzer-operation-epoch";
import { useCallback, useRef, useState } from "react";
import {
  buildAudioAnalyzerPatch,
} from "../../lib/analyzer-guided-merge";
import {
  hasMeaningfulHighlightRange,
  sliceAudioBlobToHighlightRange,
} from "../../lib/audio-highlight-slice";
import { formatTime } from "../../lib/audio-analyzer";
import { buildMusicGenAnalysisReport, downloadMusicGenBlob, enrichMusicGenReportWithSidecar } from "../../lib/musicgen-preview";
import {
  cancelSidecarJob,
  fetchSidecarHealth,
  generateMusicViaSidecar,
  generateMusicDraftsViaSidecar,
  generateMusicWithMelodyViaSidecar,
  generateSongViaSidecar,
  SidecarJobCancelledError,
  waitForSidecar,
} from "../../lib/sidecar-bridge";
import { musicGenInstallHint } from "../../lib/sidecar-capabilities";
import { isTauriApp } from "../../lib/dsp-bridge";
import { resolvePolishStepIndex } from "../../lib/suno-guided-workflow";
import { reportCaughtError } from "../../lib/fail-safe-runtime-capture";
import { cacheGeneratedAudioDraft } from "../../lib/generated-audio-cache";
import { cacheMusicGenDraftCandidates, loadSavedMusicGenDraft } from "../../lib/musicgen-draft-search";

export function useAnalyzerGenerate({
  audioEpochRef: sharedAudioEpochRef,
  audioAnalysis,
  setAudioAnalysis,
  setAudioPreviewFromBlob,
  syncCacheKeysRef,
  audioPreviewUrlRef,
  applyAnalyzerPatch,
  promptEngine,
  setGuidedStep,
  setSidecarGenerateAvailable,
  setStatusWithTime,
}) {
  const localAudioEpochRef = useRef(0);
  const audioEpochRef = sharedAudioEpochRef || localAudioEpochRef;
  const musicBusyRef = useRef(false);
  const songBusyRef = useRef(false);
  const [generateMusicBusy, setGenerateMusicBusy] = useState(false);
  const [generateSongBusy, setGenerateSongBusy] = useState(false);
  const [musicJobId, setMusicJobId] = useState("");
  const [songJobId, setSongJobId] = useState("");
  const [musicCancelRequested, setMusicCancelRequested] = useState(false);
  const [songCancelRequested, setSongCancelRequested] = useState(false);

  const cancelMusicGeneration = useCallback(async () => {
    if (!musicJobId || musicCancelRequested) return;
    setMusicCancelRequested(true);
    try {
      const job = await cancelSidecarJob(musicJobId);
      setStatusWithTime(
        job.status === "cancelled"
          ? "MusicGen generation cancelled"
          : job.status === "done"
            ? "MusicGen had already finished — keeping its result"
            : "Cancellation requested — the current inference may finish safely",
        "info",
      );
    } catch (err) {
      setMusicCancelRequested(false);
      setStatusWithTime(err instanceof Error ? err.message.slice(0, 120) : "Could not cancel MusicGen", "warning");
    }
  }, [musicCancelRequested, musicJobId, setStatusWithTime]);

  const cancelSongGeneration = useCallback(async () => {
    if (!songJobId || songCancelRequested) return;
    setSongCancelRequested(true);
    try {
      const job = await cancelSidecarJob(songJobId);
      setStatusWithTime(
        job.status === "cancelled"
          ? "ACE-Step generation cancelled"
          : job.status === "done"
            ? "ACE-Step had already finished — keeping its result"
            : "Cancellation requested — the current inference may finish safely",
        "info",
      );
    } catch (err) {
      setSongCancelRequested(false);
      setStatusWithTime(err instanceof Error ? err.message.slice(0, 120) : "Could not cancel ACE-Step", "warning");
    }
  }, [setStatusWithTime, songCancelRequested, songJobId]);

  const navigateToPolishStep = useCallback(() => {
    setGuidedStep(resolvePolishStepIndex());
  }, [setGuidedStep]);

  const generateMusicFromPrompt = useCallback(
    async (prompt, durationSec = 10, options = {}) => {
      const text = String(options.savedDraft ? audioAnalysis?.musicGenPrompt : prompt || "").trim();
      if (!text) {
        setStatusWithTime("Enter a MusicGen prompt first", "warning");
        return { status: "failed", message: "Enter a MusicGen prompt first" };
      }
      if (musicBusyRef.current) return { status: "failed", message: "A MusicGen generation is already running" };
      let jobId;

      const attach = options.attach !== false;
      const download = !!options.download;

      const epoch = advanceAnalyzerEpoch(audioEpochRef);
      const isCurrent = () => audioEpochRef.current === epoch;
      const sourceUrl = audioPreviewUrlRef.current;
      musicBusyRef.current = true;
      setGenerateMusicBusy(true);
      setMusicJobId("");
      setMusicCancelRequested(false);
      try {
        setStatusWithTime("MusicGen queued…");
        const sidecarReady = options.savedDraft || await waitForSidecar(isTauriApp() ? 120_000 : 60_000);
        if (!isCurrent()) return;
        if (!sidecarReady) {
          setStatusWithTime("Librosa sidecar offline — start it with npm run sidecar", "warning");
          return { status: "failed", message: "Local AI service is offline" };
        }
        const health = options.savedDraft ? { generate_available: true } : await fetchSidecarHealth();
        if (!health?.generate_available) {
          setStatusWithTime(
            `MusicGen not installed — run ${musicGenInstallHint(health)} (CC-BY-NC weights)`,
            "warning",
          );
          setSidecarGenerateAvailable(false);
          return { status: "failed", message: "MusicGen is not installed" };
        }
        const generationOptions = {
          ...options,
          seed: Number.isInteger(options.seed) ? Math.max(0, Math.min(options.seed, 0x7fffffff)) : (crypto.getRandomValues(new Uint32Array(1))[0] & 0x7fffffff),
          onJobStarted: (id) => {
            jobId = id;
            setMusicJobId(id);
            options.onJobStarted?.(id);
          },
          onProgress: (progress, message) => {
            if (!isCurrent()) return;
            setStatusWithTime(
              `MusicGen ${Math.round((Number(progress) || 0) * 100)}% — ${message || "working"}`.slice(0, 140),
            );
          },
        };
        const generated = options.savedDraft
          ? await loadSavedMusicGenDraft(options.savedDraft, audioAnalysis)
          : options.candidateCount > 1
            ? await (async () => {
                let referenceBlob;
                if (options.compareReference || options.useMelodyReference) {
                  if (!sourceUrl) throw new Error("Load reference audio before comparing styles");
                  const response = await fetch(sourceUrl);
                  if (!response.ok) throw new Error("Reference audio could not be read");
                  referenceBlob = await response.blob();
                  if (options.useHighlightMelody && hasMeaningfulHighlightRange(audioAnalysis)) {
                    referenceBlob = await sliceAudioBlobToHighlightRange(referenceBlob, audioAnalysis.highlightStart,
                      audioAnalysis.highlightEnd, "highlight-reference.wav");
                  }
                }
                return generateMusicDraftsViaSidecar(text, durationSec, { ...generationOptions, referenceBlob });
              })()
          : options.useMelodyReference
          ? await (async () => {
              let melodyBlob = options.melodyBlob;
              if (!melodyBlob && sourceUrl) {
                const res = await fetch(sourceUrl);
                if (res.ok) melodyBlob = await res.blob();
              }
              if (!melodyBlob) {
                throw new Error("No melody reference — load a track in the analyzer first");
              }
              if (
                options.useHighlightMelody &&
                audioAnalysis &&
                hasMeaningfulHighlightRange(audioAnalysis)
              ) {
                melodyBlob = await sliceAudioBlobToHighlightRange(
                  melodyBlob,
                  audioAnalysis.highlightStart,
                  audioAnalysis.highlightEnd,
                  `highlight-${audioAnalysis.fileName || "melody.wav"}`,
                );
              }
              return generateMusicWithMelodyViaSidecar(
                text,
                durationSec,
                melodyBlob,
                audioAnalysis?.fileName || "melody-reference.wav",
                generationOptions,
              );
            })()
          : await generateMusicViaSidecar(text, durationSec, {
              ...generationOptions,
            });
        const { blob, model, durationSec: dur, mode } = generated;
        const draftSearch = options.savedDraft ? generated.search : await cacheMusicGenDraftCandidates(generated);
        const resolvedDuration = dur || durationSec;
        const fileName = `musicgen-preview-${Date.now()}.wav`;
        const file =
          blob instanceof File ? blob : new File([blob], fileName, { type: blob.type || "audio/wav" });

        if (attach) {
          let report = await buildMusicGenAnalysisReport(file, {
            prompt: text,
            model,
            durationSec: resolvedDuration,
            fileName,
            mode: mode || (options.useMelodyReference ? "melody" : "text"),
            highlightMelody:
              !!options.useHighlightMelody &&
              !!audioAnalysis &&
              hasMeaningfulHighlightRange(audioAnalysis),
          });
          report = await enrichMusicGenReportWithSidecar(file, report);
          report.musicGenSettings = {
            seed: draftSearch ? draftSearch.candidates.find(take => take.index === draftSearch.selected_index)?.seed : generationOptions.seed,
            temperature: options.temperature ?? 1,
            topK: options.topK ?? 250,
            topP: options.topP ?? 0,
            cfgCoef: options.cfgCoef ?? 3,
            model,
            mode: mode || "text",
          };
          if (draftSearch) report.musicGenSearch = draftSearch;
          report = await cacheGeneratedAudioDraft(file, report);
          if (!isCurrent()) return { status: "cancelled", message: "Audio source changed" };
          setAudioPreviewFromBlob(file);
          setAudioAnalysis(report);
          syncCacheKeysRef(report);

          if (options.mergeAfterGenerate !== false) {
            applyAnalyzerPatch(buildAudioAnalyzerPatch(report, formatTime));
            if (promptEngine === "Suno-like") {
              navigateToPolishStep();
            }
            const highlightNote =
              options.useHighlightMelody &&
              audioAnalysis &&
              hasMeaningfulHighlightRange(audioAnalysis)
                ? " · highlight"
                : "";
            const melodyNote =
              mode === "melody" || options.useMelodyReference ? " · melody" : "";
            setStatusWithTime(
              `MusicGen preview merged into Suno fields (${model || "musicgen"} · ${resolvedDuration}s${melodyNote}${highlightNote})`,
              "success",
            );
          } else {
            setStatusWithTime(
              `MusicGen preview loaded in player (${model || "musicgen"} · ${resolvedDuration}s) — merge when ready`,
              "success",
            );
          }
          if (report.audioCacheWarning) setStatusWithTime(report.audioCacheWarning, "warning");
        }

        if (!isCurrent()) return { status: "cancelled", message: "Audio source changed" };
        if (download) {
          await downloadMusicGenBlob(file, fileName);
          if (!isCurrent()) return;
          if (!attach) {
            setStatusWithTime(
              `MusicGen preview downloaded (${model || "musicgen"} · ${resolvedDuration}s)`,
              "success",
            );
          }
        }
        return { status: "completed", jobId, artifact: { kind: "audio", fileName, model, durationSec: resolvedDuration } };
      } catch (err) {
        if (!isCurrent()) return { status: "cancelled", message: "Audio source changed" };
        if (err instanceof SidecarJobCancelledError) {
          setStatusWithTime("MusicGen generation cancelled", "info");
          return { status: "cancelled", jobId, message: "MusicGen generation cancelled" };
        }
        reportCaughtError("analyzers.generateMusicFromPrompt", err);
        const msg = err instanceof Error ? err.message : "MusicGen generation failed";
        setStatusWithTime(msg.slice(0, 120), "warning");
        return { status: "failed", jobId, error: msg, message: msg };
      } finally {
        musicBusyRef.current = false;
        setGenerateMusicBusy(false);
        setMusicJobId("");
        setMusicCancelRequested(false);
      }
    },
    [audioEpochRef, applyAnalyzerPatch, navigateToPolishStep, promptEngine, audioAnalysis, audioPreviewUrlRef, setAudioAnalysis, setAudioPreviewFromBlob, setSidecarGenerateAvailable, setStatusWithTime, syncCacheKeysRef],
  );

  const generateSongFromPrompt = useCallback(
    async (prompt, options = {}) => {
      const text = String(prompt || "").trim();
      if (!text || songBusyRef.current) return;
      const attach = options.attach !== false;
      const download = !!options.download;
      const durationSec = Number(options.durationSec) || 60;
      const lyrics = String(options.lyrics || "").trim();
      const seed = Number.isInteger(options.seed) ? Math.max(0, Math.min(options.seed, 0x7fffffff)) : (crypto.getRandomValues(new Uint32Array(1))[0] & 0x7fffffff);

      const epoch = advanceAnalyzerEpoch(audioEpochRef);
      const isCurrent = () => audioEpochRef.current === epoch;
      const sourceUrl = audioPreviewUrlRef.current;
      songBusyRef.current = true;
      setGenerateSongBusy(true);
      setSongJobId("");
      setSongCancelRequested(false);
      try {
        setStatusWithTime("ACE-Step queued — starting the API if it is down…");
        const sidecarReady = await waitForSidecar(isTauriApp() ? 120_000 : 60_000);
        if (!isCurrent()) return;
        if (!sidecarReady) {
          setStatusWithTime("Librosa sidecar offline — start it with npm run sidecar", "warning");
          return;
        }
        const { blob, model, durationSec: dur, compositionPlan } = await generateSongViaSidecar({
          prompt: text,
          lyrics,
          durationSec,
          bpm: options.bpm ?? null,
          keyScale: options.keyScale || "",
          vocalLanguage: options.vocalLanguage || "",
          thinking: options.thinking !== false,
          inferenceSteps: options.inferenceSteps,
          guidanceScale: options.guidanceScale,
          seed,
          model: options.model || "",
          compose: !!options.compose,
          instrumental: options.instrumental !== false,
          onProgress: (progress, message) => {
            if (!isCurrent()) return;
            setStatusWithTime(
              `ACE-Step ${Math.round((Number(progress) || 0) * 100)}% — ${message || "working"}`.slice(0, 140),
            );
          },
          onJobStarted: setSongJobId,
        });
        const resolvedDuration = dur || durationSec;
        const fileName = `acestep-song-${Date.now()}.wav`;
        const file =
          blob instanceof File ? blob : new File([blob], fileName, { type: blob.type || "audio/wav" });

        if (attach) {
          let report = await buildMusicGenAnalysisReport(file, {
            prompt: text,
            model: model || "acestep",
            durationSec: resolvedDuration,
            fileName,
            mode: "acestep-song",
          });
          report = {
            ...(await enrichMusicGenReportWithSidecar(file, report)),
            sourceEngine: "acestep",
            trackSummary: `ACE-Step song (${model || "acestep"}, ${resolvedDuration}s): ${text.slice(0, 160)}`,
            vocals: compositionPlan ? (compositionPlan.instrumental ? "Instrumental (AI composition)" : "Vocals (AI composition)") : lyrics ? "Vocals (ACE-Step)" : report.vocals,
            aceStepLyrics: compositionPlan?.lyrics ?? lyrics,
            compositionPlan: compositionPlan || null,
            musicGenSettings: { seed, model, thinking: !!options.compose || options.thinking !== false,
              compose: !!options.compose, instrumental: options.instrumental !== false, originalLyrics: lyrics,
              vocalLanguage: compositionPlan?.vocal_language || options.vocalLanguage || "",
              useDna: options.useDna ?? !!(options.bpm || options.keyScale),
              inferenceSteps: options.inferenceSteps, guidanceScale: options.guidanceScale,
              bpm: options.bpm, keyScale: options.keyScale, mode: "acestep-song" },
          };
          report = await cacheGeneratedAudioDraft(file, report);
          if (!isCurrent()) return { status: "cancelled", message: "Audio source changed" };
          setAudioPreviewFromBlob(file);
          setAudioAnalysis(report);
          syncCacheKeysRef(report);
          setStatusWithTime(
            `ACE-Step song loaded (${model || "acestep"} · ${resolvedDuration}s)`,
            "success",
          );
          if (report.audioCacheWarning) setStatusWithTime(report.audioCacheWarning, "warning");
        }

        if (!isCurrent()) return { status: "cancelled", message: "Audio source changed" };
        if (download) {
          await downloadMusicGenBlob(file, fileName);
          if (!isCurrent()) return;
          if (!attach) {
            setStatusWithTime(
              `ACE-Step song downloaded (${model || "acestep"} · ${resolvedDuration}s)`,
              "success",
            );
          }
        }
      } catch (err) {
        if (!isCurrent()) return { status: "cancelled", message: "Audio source changed" };
        if (err instanceof SidecarJobCancelledError) {
          setStatusWithTime("ACE-Step generation cancelled", "info");
          return;
        }
        reportCaughtError("analyzers.generateSongFromPrompt", err);
        const msg = err instanceof Error ? err.message : "ACE-Step generation failed";
        setStatusWithTime(msg.slice(0, 120), "warning");
      } finally {
        songBusyRef.current = false;
        setGenerateSongBusy(false);
        setSongJobId("");
        setSongCancelRequested(false);
      }
    },
    [
      audioEpochRef,
      audioPreviewUrlRef,
      setAudioAnalysis,
      setAudioPreviewFromBlob,
      setStatusWithTime,
      syncCacheKeysRef,
    ],
  );

  return {
    cancelMusicGeneration,
    cancelSongGeneration,
    generateMusicCanCancel: !!musicJobId,
    generateSongCanCancel: !!songJobId,
    generateMusicBusy,
    generateMusicFromPrompt,
    generateMusicCancelRequested: musicCancelRequested,
    generateSongBusy,
    generateSongFromPrompt,
    generateSongCancelRequested: songCancelRequested,
  };
}
