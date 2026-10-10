"use client";

import { advanceAnalyzerEpoch } from "../../lib/analyzer-operation-epoch";
import { useCallback, useRef, useState } from "react";
import { runLocalCoverRemixJob } from "../../lib/local-cover-remix-engine";
import { buildLocalTrackDna, resolveLocalCoverRemixEngine } from "../../lib/local-track-dna";
import {
  buildMusicGenAnalysisReport,
  downloadMusicGenBlob,
  enrichMusicGenReportWithSidecar,
} from "../../lib/musicgen-preview";
import { cacheGeneratedAudioDraft } from "../../lib/generated-audio-cache";
import { reportCaughtError } from "../../lib/fail-safe-runtime-capture";

/**
 * Local cover/remix engine hook (no Suno).
 */
export function useLocalCoverRemix({
  audioEpochRef: sharedAudioEpochRef,
  audioAnalysis,
  setAudioAnalysis,
  setAudioPreviewFromBlob,
  syncCacheKeysRef,
  audioPreviewUrlRef,
  setStatusWithTime,
}) {
  const localAudioEpochRef = useRef(0);
  const audioEpochRef = sharedAudioEpochRef || localAudioEpochRef;
  const busyRef = useRef(false);

  const [localCoverRemixBusy, setLocalCoverRemixBusy] = useState(false);

  const runLocalCoverRemix = useCallback(
    async (options = {}) => {
      if (busyRef.current) return;
      if (!audioAnalysis) {
        setStatusWithTime("Load a track in Analyzers first", "warning");
        return;
      }
      const epoch = advanceAnalyzerEpoch(audioEpochRef);
      const isCurrent = () => audioEpochRef.current === epoch;
      const sourceUrl = audioPreviewUrlRef.current;
      busyRef.current = true;
      let cacheWarning = null;
      setLocalCoverRemixBusy(true);
      try {
        let mixBlob = options.audioBlob || null;
        if (!mixBlob && sourceUrl) {
          const res = await fetch(sourceUrl);
          if (res.ok) mixBlob = await res.blob();
        }
        if (!isCurrent()) return;
        if (!mixBlob) {
          throw new Error("No mix loaded — drop an audio file first");
        }

        const mode = options.mode === "remix" ? "remix" : "cover";
        setStatusWithTime(
          mode === "remix"
            ? "Local remix started (stems → vocal transform)…"
            : "Local cover started (reverse DNA → generate)…",
        );

        const result = await runLocalCoverRemixJob({
          mode,
          analysis: audioAnalysis,
          audioBlob: mixBlob,
          lyrics: options.lyrics,
          durationSec: options.durationSec,
          useHighlightMelody: options.useHighlightMelody,
          remixPitchSemitones: options.remixPitchSemitones,
        });

        const file =
          result.blob instanceof File
            ? result.blob
            : new File([result.blob], result.fileName, {
                type: result.blob.type || "audio/wav",
              });

        const attach = options.attach !== false;
        const download = !!options.download;

        if (attach) {
          let report = await buildMusicGenAnalysisReport(file, {
            prompt: result.dna.prompt,
            model: result.model,
            durationSec: result.durationSec,
            fileName: result.fileName,
            mode: `local-${result.mode}-${result.engine}`,
          });
          report = await enrichMusicGenReportWithSidecar(file, report);
          report = {
            ...report,
            sourceEngine: `local-${result.engine}`,
            trackSummary: `Local ${result.mode} (${result.engine}): ${result.dna.prompt.slice(0, 140)}`,
          };
          report = await cacheGeneratedAudioDraft(file, report);
          if (!isCurrent()) return;
          cacheWarning = report.audioCacheWarning;
          setAudioPreviewFromBlob(file);
          setAudioAnalysis(report);
          syncCacheKeysRef?.(report);
        }

        if (!isCurrent()) return;
        if (download) {
          await downloadMusicGenBlob(file, result.fileName);
          if (!isCurrent()) return;
        }

        setStatusWithTime(
          `Local ${result.mode} ready (${result.engine}${result.durationSec ? ` · ${result.durationSec}s` : ""})`,
          "success",
        );
        if (cacheWarning && isCurrent()) setStatusWithTime(cacheWarning, "warning");
        return result;
      } catch (err) {
        if (!isCurrent()) return;
        reportCaughtError("analyzers.runLocalCoverRemix", err);
        const msg = err instanceof Error ? err.message : "Local cover/remix failed";
        setStatusWithTime(msg.slice(0, 140), "warning");
        return null;
      } finally {
        busyRef.current = false;
        setLocalCoverRemixBusy(false);
      }
    },
    [
      audioEpochRef,
      audioAnalysis,
      audioPreviewUrlRef,
      setAudioAnalysis,
      setAudioPreviewFromBlob,
      setStatusWithTime,
      syncCacheKeysRef,
    ],
  );

  const previewLocalCoverDna = useCallback(() => {
    if (!audioAnalysis) return null;
    return buildLocalTrackDna(audioAnalysis);
  }, [audioAnalysis]);

  const previewLocalCoverEngine = useCallback(
    (mode, health) => resolveLocalCoverRemixEngine(mode === "remix" ? "remix" : "cover", health),
    [],
  );

  return {
    localCoverRemixBusy,
    runLocalCoverRemix,
    previewLocalCoverDna,
    previewLocalCoverEngine,
  };
}
