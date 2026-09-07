"use client";

import { useCallback, useState } from "react";
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
  fetchSidecarHealth,
  generateMusicViaSidecar,
  generateMusicWithMelodyViaSidecar,
  generateSongViaSidecar,
  waitForSidecar,
} from "../../lib/sidecar-bridge";
import { musicGenInstallHint } from "../../lib/sidecar-capabilities";
import { isTauriApp } from "../../lib/dsp-bridge";
import { resolvePolishStepIndex } from "../../lib/suno-guided-workflow";
import { reportCaughtError } from "../../lib/fail-safe-runtime-capture";

export function useAnalyzerGenerate({
  audioAnalysis,
  setAudioAnalysis,
  setAudioPreviewFromBlob,
  syncCacheKeysRef,
  audioPreviewUrlRef,
  applyAnalyzerPatch,
  promptEngine,
  setGuidedStep,
  setSidecarGenerateAvailable,
  setSidecarAcestepAvailable,
  setStatusWithTime,
}) {
  const [generateMusicBusy, setGenerateMusicBusy] = useState(false);
  const [generateSongBusy, setGenerateSongBusy] = useState(false);

  const navigateToPolishStep = useCallback(() => {
    setGuidedStep(resolvePolishStepIndex());
  }, [setGuidedStep]);

  const generateMusicFromPrompt = useCallback(
    async (prompt, durationSec = 10, options = {}) => {
      const text = String(prompt || "").trim();
      if (!text) {
        setStatusWithTime("Enter a MusicGen prompt first", "warning");
        return;
      }
      if (generateMusicBusy) return;

      const attach = options.attach !== false;
      const download = !!options.download;

      setGenerateMusicBusy(true);
      try {
        setStatusWithTime("MusicGen generation started (this may take a minute)…");
        const sidecarReady = await waitForSidecar(isTauriApp() ? 120_000 : 60_000);
        if (!sidecarReady) {
          setStatusWithTime("Librosa sidecar offline — start it with npm run sidecar", "warning");
          return;
        }
        const health = await fetchSidecarHealth();
        if (!health?.generate_available) {
          setStatusWithTime(
            `MusicGen not installed — run ${musicGenInstallHint(health)} (CC-BY-NC weights)`,
            "warning",
          );
          setSidecarGenerateAvailable(false);
          return;
        }
        const { blob, model, durationSec: dur, mode } = options.useMelodyReference
          ? await (async () => {
              let melodyBlob = options.melodyBlob;
              if (!melodyBlob && audioPreviewUrlRef.current) {
                const res = await fetch(audioPreviewUrlRef.current);
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
              );
            })()
          : await generateMusicViaSidecar(text, durationSec);
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
        }

        if (download) {
          downloadMusicGenBlob(file, fileName);
          if (!attach) {
            setStatusWithTime(
              `MusicGen preview downloaded (${model || "musicgen"} · ${resolvedDuration}s)`,
              "success",
            );
          }
        }
      } catch (err) {
        reportCaughtError("analyzers.generateMusicFromPrompt", err);
        const msg = err instanceof Error ? err.message : "MusicGen generation failed";
        setStatusWithTime(msg.slice(0, 120), "warning");
      } finally {
        setGenerateMusicBusy(false);
      }
    },
    [applyAnalyzerPatch, generateMusicBusy, navigateToPolishStep, promptEngine, audioAnalysis, audioPreviewUrlRef, setAudioAnalysis, setAudioPreviewFromBlob, setSidecarGenerateAvailable, setStatusWithTime, syncCacheKeysRef],
  );

  const generateSongFromPrompt = useCallback(
    async (prompt, options = {}) => {
      const text = String(prompt || "").trim();
      if (!text || generateSongBusy) return;
      const attach = options.attach !== false;
      const download = !!options.download;
      const durationSec = Number(options.durationSec) || 60;
      const lyrics = String(options.lyrics || "").trim();

      setGenerateSongBusy(true);
      try {
        setStatusWithTime("ACE-Step full-song generation started (this can take a few minutes)…");
        const sidecarReady = await waitForSidecar(isTauriApp() ? 120_000 : 60_000);
        if (!sidecarReady) {
          setStatusWithTime("Librosa sidecar offline — start it with npm run sidecar", "warning");
          return;
        }
        const health = await fetchSidecarHealth();
        if (!health?.acestep_available) {
          setStatusWithTime(
            "ACE-Step not configured — set AIMC_ACESTEP_API_URL (see docs/acestep.md)",
            "warning",
          );
          setSidecarAcestepAvailable(false);
          return;
        }
        const { blob, model, durationSec: dur } = await generateSongViaSidecar({
          prompt: text,
          lyrics,
          durationSec,
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
            vocals: lyrics ? "Vocals (ACE-Step)" : report.vocals,
          };
          setAudioPreviewFromBlob(file);
          setAudioAnalysis(report);
          syncCacheKeysRef(report);
          setStatusWithTime(
            `ACE-Step song loaded (${model || "acestep"} · ${resolvedDuration}s)`,
            "success",
          );
        }

        if (download) {
          downloadMusicGenBlob(file, fileName);
          if (!attach) {
            setStatusWithTime(
              `ACE-Step song downloaded (${model || "acestep"} · ${resolvedDuration}s)`,
              "success",
            );
          }
        }
      } catch (err) {
        reportCaughtError("analyzers.generateSongFromPrompt", err);
        const msg = err instanceof Error ? err.message : "ACE-Step generation failed";
        setStatusWithTime(msg.slice(0, 120), "warning");
      } finally {
        setGenerateSongBusy(false);
      }
    },
    [
      generateSongBusy,
      setAudioAnalysis,
      setAudioPreviewFromBlob,
      setSidecarAcestepAvailable,
      setStatusWithTime,
      syncCacheKeysRef,
    ],
  );

  return {
    generateMusicBusy,
    generateMusicFromPrompt,
    generateSongBusy,
    generateSongFromPrompt,
  };
}
