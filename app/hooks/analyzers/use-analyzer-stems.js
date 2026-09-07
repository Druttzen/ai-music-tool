"use client";

import { useCallback, useState } from "react";
import { resolveAudioCacheBlob } from "../../lib/audio-cache";
import { downloadSidecarStem, separateStemsViaSidecar, waitForSidecar } from "../../lib/sidecar-bridge";
import { isTauriApp } from "../../lib/dsp-bridge";
import { reportCaughtError } from "../../lib/fail-safe-runtime-capture";

export function useAnalyzerStems({ audioAnalysis, setStatusWithTime }) {
  const [stemSeparationBusy, setStemSeparationBusy] = useState(false);
  const [stemSeparationStems, setStemSeparationStems] = useState([]);

  const clearStems = useCallback(() => {
    setStemSeparationStems([]);
  }, []);

  const separateStems = useCallback(
    async (modelName = "htdemucs") => {
      if (!audioAnalysis) {
        setStatusWithTime("No track loaded for stem separation");
        return;
      }
      if (stemSeparationBusy) return;

      const model = String(modelName || "htdemucs").trim() || "htdemucs";
      const isMelband = model.toLowerCase().startsWith("melband");
      setStemSeparationBusy(true);
      setStemSeparationStems([]);
      try {
        setStatusWithTime(
          isMelband ? "Mel-Band RoFormer separation started…" : "Demucs stem separation started…",
        );
        const resolved = await resolveAudioCacheBlob(audioAnalysis);
        const blob = resolved?.blob;
        if (!blob) {
          setStatusWithTime("Re-attach the audio file before stem separation", "warning");
          return;
        }
        const sidecarReady = await waitForSidecar(isTauriApp() ? 120_000 : 60_000);
        if (!sidecarReady) {
          setStatusWithTime("Librosa sidecar offline — start it with npm run sidecar", "warning");
          return;
        }
        const result = await separateStemsViaSidecar(
          blob,
          audioAnalysis.fileName || "track.wav",
          model,
        );
        setStemSeparationStems(result.stems || []);
        const device = result.device ? ` on ${result.device}` : "";
        setStatusWithTime(
          `Stems ready (${result.sources.join(", ")})${device} — ${result.model || model}`,
        );
      } catch (err) {
        reportCaughtError("analyzers.separateStems", err);
        const msg = err instanceof Error ? err.message : "Stem separation failed";
        setStatusWithTime(msg.slice(0, 100), "warning");
      } finally {
        setStemSeparationBusy(false);
      }
    },
    [audioAnalysis, setStatusWithTime, stemSeparationBusy],
  );

  const downloadStem = useCallback(
    async (stem) => {
      if (!stem?.download_url || !audioAnalysis) return;
      const base = String(audioAnalysis.fileName || "track").replace(/\.[^.]+$/, "");
      try {
        await downloadSidecarStem(stem.download_url, `${base}-${stem.filename}`);
        setStatusWithTime(`Downloaded ${stem.name} stem`);
      } catch (err) {
        reportCaughtError("analyzers.downloadStem", err);
        const msg = err instanceof Error ? err.message : "Stem download failed";
        setStatusWithTime(msg.slice(0, 80), "warning");
      }
    },
    [audioAnalysis, setStatusWithTime],
  );

  return {
    clearStems,
    downloadStem,
    separateStems,
    stemSeparationBusy,
    stemSeparationStems,
  };
}
