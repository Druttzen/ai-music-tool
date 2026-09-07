"use client";

import { useCallback, useState } from "react";
import {
  hasMeaningfulHighlightRange,
} from "../../lib/audio-highlight-slice";
import { buildMusicGenAnalysisReport, downloadMusicGenBlob, enrichMusicGenReportWithSidecar } from "../../lib/musicgen-preview";
import { fetchSidecarHealth, transformVocalsViaSidecar, waitForSidecar } from "../../lib/sidecar-bridge";
import { isTauriApp } from "../../lib/dsp-bridge";
import { reportCaughtError } from "../../lib/fail-safe-runtime-capture";

export function useAnalyzerVocals({
  audioAnalysis,
  setAudioAnalysis,
  setAudioPreviewFromBlob,
  syncCacheKeysRef,
  audioPreviewUrlRef,
  setSidecarVocalTransformAvailable,
  setStatusWithTime,
}) {
  const [vocalTransformBusy, setVocalTransformBusy] = useState(false);

  const transformVocalsOnTrack = useCallback(
    async (options = {}) => {
      if (vocalTransformBusy || !audioAnalysis) return;
      setVocalTransformBusy(true);
      try {
        setStatusWithTime("Vocal transform started (separate → rewrite → remix)…");
        const sidecarReady = await waitForSidecar(isTauriApp() ? 120_000 : 60_000);
        if (!sidecarReady) {
          setStatusWithTime("Librosa sidecar offline — start it with npm run sidecar", "warning");
          return;
        }
        const health = await fetchSidecarHealth();
        if (!health?.vocal_transform_available) {
          setStatusWithTime(
            "Vocal transform needs Demucs or Mel-Band — npm run sidecar:stems / sidecar:stems-melband",
            "warning",
          );
          setSidecarVocalTransformAvailable(false);
          return;
        }
        let mixBlob = null;
        if (audioPreviewUrlRef.current) {
          const res = await fetch(audioPreviewUrlRef.current);
          if (res.ok) mixBlob = await res.blob();
        }
        if (!mixBlob) {
          throw new Error("No mix loaded — drop an audio file first");
        }

        const scope = options.regionScope || (options.useHighlight ? "highlight" : "full");
        let regions = [];
        if (scope === "highlight" && hasMeaningfulHighlightRange(audioAnalysis)) {
          regions = [
            {
              start_sec: Number(audioAnalysis.highlightStart) || 0,
              end_sec: Number(audioAnalysis.highlightEnd) || 0,
            },
          ];
        } else if (scope === "all") {
          if (hasMeaningfulHighlightRange(audioAnalysis)) {
            regions.push({
              start_sec: Number(audioAnalysis.highlightStart) || 0,
              end_sec: Number(audioAnalysis.highlightEnd) || 0,
            });
          }
          for (const r of audioAnalysis.vocalRegions || []) {
            regions.push({
              start_sec: Number(r.start) || 0,
              end_sec: Number(r.end) || 0,
            });
          }
        }

        const { remixBlob, vocalsBlob, mode } = await transformVocalsViaSidecar({
          file: mixBlob,
          fileName: audioAnalysis.fileName || "mix.wav",
          mode: options.mode || "pitch",
          regions,
          pitchSemitones: options.pitchSemitones ?? 0,
          formantShift: options.formantShift ?? options.pitchSemitones ?? 0,
          output: options.downloadVocals === false ? "remix" : "both",
        });

        if (remixBlob) {
          const fileName = `remix-transformed-${Date.now()}.wav`;
          const file = new File([remixBlob], fileName, { type: "audio/wav" });
          let report = await buildMusicGenAnalysisReport(file, {
            prompt: `vocal-transform:${mode || options.mode || "pitch"}`,
            model: mode || options.mode || "pitch",
            fileName,
            mode: "vocal-transform",
          });
          report = await enrichMusicGenReportWithSidecar(file, report);
          report = {
            ...report,
            sourceEngine: "vocal-transform",
            trackSummary: `Vocal transform (${mode || options.mode || "pitch"})`,
            vocals: "Transformed vocals",
          };
          setAudioPreviewFromBlob(file);
          setAudioAnalysis(report);
          syncCacheKeysRef(report);
        }

        if (options.downloadVocals !== false && vocalsBlob) {
          downloadMusicGenBlob(vocalsBlob, `vocals-transformed-${Date.now()}.wav`);
        }

        setStatusWithTime(
          `Vocal transform done (${mode || options.mode || "pitch"}${
            vocalsBlob ? " · acapella downloaded" : ""
          })`,
          "success",
        );
      } catch (err) {
        reportCaughtError("analyzers.transformVocalsOnTrack", err);
        const msg = err instanceof Error ? err.message : "Vocal transform failed";
        setStatusWithTime(msg.slice(0, 120), "warning");
      } finally {
        setVocalTransformBusy(false);
      }
    },
    [
      audioAnalysis,
      audioPreviewUrlRef,
      setAudioAnalysis,
      setAudioPreviewFromBlob,
      setSidecarVocalTransformAvailable,
      setStatusWithTime,
      syncCacheKeysRef,
      vocalTransformBusy,
    ],
  );

  return {
    transformVocalsOnTrack,
    vocalTransformBusy,
  };
}
