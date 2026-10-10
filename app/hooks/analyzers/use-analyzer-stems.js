"use client";

import { audioSourceKey } from "../../lib/analyzer-operation-epoch";
import { useCallback, useRef, useState } from "react";
import { resolveAudioCacheBlob } from "../../lib/audio-cache";
import { downloadSidecarStem, separateStemsViaSidecar, waitForSidecar } from "../../lib/sidecar-bridge";
import { isTauriApp } from "../../lib/dsp-bridge";
import { reportCaughtError } from "../../lib/fail-safe-runtime-capture";

export function useAnalyzerStems({ audioAnalysis, audioEpochRef: sharedAudioEpochRef, setStatusWithTime }) {
  const localEpochRef = useRef(0);
  const audioEpochRef = sharedAudioEpochRef || localEpochRef;
  const busyRef = useRef(false);
  const downloadBusyRef = useRef(false);
  const separationEpochRef = useRef(0);
  const [stemSeparationBusy, setStemSeparationBusy] = useState(false);
  const [stemSeparationStems, setStemSeparationStems] = useState([]);

  const clearStems = useCallback(() => {
    separationEpochRef.current += 1;
    setStemSeparationStems([]);
  }, []);

  const separateStems = useCallback(
    async (modelName = "auto") => {
      if (!audioAnalysis) {
        setStatusWithTime("No track loaded for stem separation");
        return;
      }
      if (busyRef.current) return;
      const sourceEpoch = audioEpochRef.current;
      const run = ++separationEpochRef.current;
      const isCurrent = () => audioEpochRef.current === sourceEpoch && separationEpochRef.current === run;
      const sourceFileName = audioAnalysis.fileName || "track.wav";
      busyRef.current = true;

      const model = String(modelName || "auto").trim() || "auto";
      const isMelband = model.toLowerCase().startsWith("melband");
      setStemSeparationBusy(true);
      setStemSeparationStems([]);
      try {
        setStatusWithTime(
          isMelband ? "Mel-Band RoFormer separation started…" : "Demucs stem separation started…",
        );
        const resolved = await resolveAudioCacheBlob(audioAnalysis);
        if (!isCurrent()) return;
        const blob = resolved?.blob;
        if (!blob) {
          setStatusWithTime("Re-attach the audio file before stem separation", "warning");
          return;
        }
        const sidecarReady = await waitForSidecar(isTauriApp() ? 120_000 : 60_000);
        if (!isCurrent()) return;
        if (!sidecarReady) {
          setStatusWithTime("Librosa sidecar offline — start it with npm run sidecar", "warning");
          return;
        }
        if (!isCurrent()) return;
        const result = await separateStemsViaSidecar(
          blob,
          audioAnalysis.fileName || "track.wav",
          model,
        );
        if (!isCurrent()) return;
        setStemSeparationStems((result.stems || []).map(stem => ({
          ...stem, sourceEpoch, sourceFileName, sourceKey: audioSourceKey(audioAnalysis), model: result.model || model, jobId: result.job_id || result.jobId || String(run),
        })));
        const device = result.device ? ` on ${result.device}` : "";
        setStatusWithTime(
          `Stems ready (${result.sources.join(", ")})${device} — ${result.model || model}`,
        );
      } catch (err) {
        if (!isCurrent()) return;
        reportCaughtError("analyzers.separateStems", err);
        const msg = err instanceof Error ? err.message : "Stem separation failed";
        setStatusWithTime(msg.slice(0, 100), "warning");
      } finally {
        busyRef.current = false;
        setStemSeparationBusy(false);
      }
    },
    [audioEpochRef, audioAnalysis, setStatusWithTime],
  );

  const downloadStem = useCallback(
    async (stem) => {
      if (!stem?.download_url || stem.sourceEpoch !== audioEpochRef.current || downloadBusyRef.current) return;
      downloadBusyRef.current = true;
      const base = String(stem.sourceFileName || "track").replace(/\.[^.]+$/, "");
      const model = String(stem.model || "stems").replace(/[^a-z0-9_-]/gi, "-");
      try {
        await downloadSidecarStem(stem.download_url, `${base}-${model}-${stem.jobId}-${stem.filename}`);
        if (stem.sourceEpoch === audioEpochRef.current) setStatusWithTime(`Downloaded ${stem.name} stem`);
      } catch (err) {
        if (stem.sourceEpoch !== audioEpochRef.current) return;
        reportCaughtError("analyzers.downloadStem", err);
        const msg = err instanceof Error ? err.message : "Stem download failed";
        setStatusWithTime(msg.slice(0, 80), "warning");
      } finally {
        downloadBusyRef.current = false;
      }
    },
    [audioEpochRef, setStatusWithTime],
  );

  return {
    clearStems,
    downloadStem,
    separateStems,
    stemSeparationBusy,
    stemSeparationStems: stemSeparationStems.filter(stem => stem.sourceKey === audioSourceKey(audioAnalysis)),
  };
}
