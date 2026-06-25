"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildAudioAnalyzerPatch,
  buildImageAnalyzerPatch,
} from "../lib/analyzer-guided-merge";
import {
  isSupportedAudioFile,
  isSupportedImageFile,
  SUPPORTED_AUDIO_LABEL,
  SUPPORTED_IMAGE_LABEL,
} from "../lib/analyzer-file-types";
import {
  audioFileMatchesAnalysis,
  deleteAudioCacheEntries,
  getAudioCacheKeysForAnalysis,
  makeAudioCacheKey,
  putAudioCacheEntries,
  resolveAudioCacheBlob,
} from "../lib/audio-cache";
import {
  analysisNeedsWaveformPeaks,
  analyzeAudioBuffer,
  decodeWaveformPeaksFromBlob,
  formatTime,
  normalizeAudioAnalysis,
  patchAudioAnalysis,
  synthesizeWaveformPeaksFromAnalysis,
} from "../lib/audio-analyzer";
import { mergeSidecarAnalysis } from "../lib/audio-analyzer-sidecar";
import { analyzeImagePixelData } from "../lib/image-analyzer";
import { analyzeAudioViaSidecar, getManagedSidecarStatus, isSidecarAvailable, resetSidecarHealthCache, waitForSidecar } from "../lib/sidecar-bridge";
import { measureIntegratedLoudness } from "../lib/lufs-meter";
import { isTauriApp, measureLoudnessBytes } from "../lib/dsp-bridge";
import { normalizeStudioExportFormat } from "../lib/audio-export-formats";
import { exportEnhancedFromBlob } from "../lib/studio-export-client";
import { resolvePolishStepIndex } from "../lib/suno-guided-workflow";

export function useAnalyzers({
  promptEngine,
  setGuidedStep,
  applyAnalyzerPatch,
  setStatusWithTime,
}) {
  const [audioAnalysis, setAudioAnalysis] = useState(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState(null);
  const [audioExportBusy, setAudioExportBusy] = useState(false);
  const [audioExportProgress, setAudioExportProgress] = useState(null);
  const [audioLoudness, setAudioLoudness] = useState(null);
  const [audioLoudnessBusy, setAudioLoudnessBusy] = useState(false);
  const loudnessGenRef = useRef(0);
  const [imageAnalysis, setImageAnalysis] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const canvasRef = useRef(null);
  const imagePreviewUrlRef = useRef(null);
  const audioPreviewUrlRef = useRef(null);
  const rehydrateGenRef = useRef(0);
  const audioCacheKeyRef = useRef(null);
  const audioCacheKeysRef = useRef([]);
  const [sidecarAiStatus, setSidecarAiStatus] = useState("checking");

  useEffect(() => {
    let cancelled = false;
    let timer = null;

    const scheduleNext = (status) => {
      if (cancelled) return;
      const delay = status === "ready" ? 30_000 : status === "standby" ? 5_000 : 2_000;
      timer = setTimeout(() => {
        void probeSidecar();
      }, delay);
    };

    const probeSidecar = async () => {
      if (cancelled) return;
      setSidecarAiStatus("checking");
      let nextStatus = "offline";
      try {
        resetSidecarHealthCache();
        const httpOk = await isSidecarAvailable();
        if (httpOk) {
          nextStatus = "ready";
        } else if (isTauriApp()) {
          const st = await getManagedSidecarStatus();
          if (st?.ready) {
            nextStatus = "ready";
          } else if (st?.spawned) {
            nextStatus = "offline";
          } else {
            nextStatus = "standby";
          }
        }
        if (!cancelled) setSidecarAiStatus(nextStatus);
      } catch {
        if (!cancelled) setSidecarAiStatus("offline");
      }
      scheduleNext(nextStatus);
    };

    void probeSidecar();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const setAudioPreviewFromBlob = useCallback((blob) => {
    if (audioPreviewUrlRef.current) URL.revokeObjectURL(audioPreviewUrlRef.current);
    const previewUrl = URL.createObjectURL(blob);
    audioPreviewUrlRef.current = previewUrl;
    setAudioPreviewUrl(previewUrl);
  }, []);

  useEffect(() => {
    return () => {
      if (imagePreviewUrlRef.current) {
        URL.revokeObjectURL(imagePreviewUrlRef.current);
        imagePreviewUrlRef.current = null;
      }
      if (audioPreviewUrlRef.current) {
        URL.revokeObjectURL(audioPreviewUrlRef.current);
        audioPreviewUrlRef.current = null;
      }
    };
  }, []);

  const syncCacheKeysRef = useCallback((report) => {
    audioCacheKeysRef.current = report ? getAudioCacheKeysForAnalysis(report) : [];
    audioCacheKeyRef.current = report?.audioCacheKey || null;
  }, []);

  const resetAnalyzers = useCallback(() => {
    deleteAudioCacheEntries(audioCacheKeysRef.current);
    audioCacheKeysRef.current = [];
    audioCacheKeyRef.current = null;
    setAudioAnalysis(null);
    setAudioPreviewUrl(null);
    setAudioLoudness(null);
    setImageAnalysis(null);
    setImagePreview(null);
    if (imagePreviewUrlRef.current) {
      URL.revokeObjectURL(imagePreviewUrlRef.current);
      imagePreviewUrlRef.current = null;
    }
    if (audioPreviewUrlRef.current) {
      URL.revokeObjectURL(audioPreviewUrlRef.current);
      audioPreviewUrlRef.current = null;
    }
  }, []);

  const updateAudioAnalysis = useCallback((patch) => {
    setAudioAnalysis((prev) => patchAudioAnalysis(prev, patch));
  }, []);

  const clearAudioAnalysis = useCallback(() => {
    deleteAudioCacheEntries(audioCacheKeysRef.current);
    audioCacheKeysRef.current = [];
    audioCacheKeyRef.current = null;
    setAudioAnalysis(null);
    setAudioPreviewUrl(null);
    setAudioLoudness(null);
    if (audioPreviewUrlRef.current) {
      URL.revokeObjectURL(audioPreviewUrlRef.current);
      audioPreviewUrlRef.current = null;
    }
  }, []);

  const clearImageAnalysis = useCallback(() => {
    setImageAnalysis(null);
    setImagePreview(null);
    if (imagePreviewUrlRef.current) {
      URL.revokeObjectURL(imagePreviewUrlRef.current);
      imagePreviewUrlRef.current = null;
    }
  }, []);

  const attachAudioFile = useCallback(
    async (file) => {
      if (!audioAnalysis) {
        setStatusWithTime("No track report to attach audio to");
        return;
      }
      if (!isSupportedAudioFile(file)) {
        setStatusWithTime(`Use ${SUPPORTED_AUDIO_LABEL} only`);
        return;
      }

      let audioContext = null;
      try {
        setStatusWithTime("Attaching audio...");
        const arrayBuffer = await file.arrayBuffer();
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const buffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));

        if (!audioFileMatchesAnalysis(file, audioAnalysis, buffer.duration)) {
          setStatusWithTime("File name/duration does not match this report — drop as new analysis instead");
          return;
        }

        const cacheKey = makeAudioCacheKey(file);
        const keys = await putAudioCacheEntries(file, cacheKey, buffer.duration);
        const peaks = await decodeWaveformPeaksFromBlob(file);

        setAudioPreviewFromBlob(file);
        setAudioAnalysis((prev) =>
          patchAudioAnalysis(prev, {
            audioCacheKey: keys.audioCacheKey,
            audioLookupKey: keys.audioLookupKey,
            waveformPeaks: peaks,
            waveformSource: "sample",
            duration: buffer.duration,
          }),
        );
        syncCacheKeysRef({
          ...audioAnalysis,
          audioCacheKey: keys.audioCacheKey,
          audioLookupKey: keys.audioLookupKey,
        });
        setStatusWithTime("Audio attached — sample-accurate waveform and playback restored");
      } catch {
        setStatusWithTime("Could not attach audio file");
      } finally {
        if (audioContext) {
          try {
            await audioContext.close();
          } catch {}
        }
      }
    },
    [audioAnalysis, setAudioPreviewFromBlob, setStatusWithTime, syncCacheKeysRef],
  );

  const analyzeAudioFile = useCallback(
    async (file) => {
      if (!isSupportedAudioFile(file)) {
        setStatusWithTime(`Use ${SUPPORTED_AUDIO_LABEL} only for audio analysis`);
        applyAnalyzerPatch({
          notes: `Audio analyzer accepts ${SUPPORTED_AUDIO_LABEL} (check file extension or MIME type).`,
        });
        return;
      }

      let audioContext = null;
      try {
        setStatusWithTime("Analyzing audio...");
        const arrayBuffer = await file.arrayBuffer();
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const buffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
        const cacheKey = makeAudioCacheKey(file);
        const report = analyzeAudioBuffer(buffer, file.name);
        try {
          const keys = await putAudioCacheEntries(file, cacheKey, buffer.duration);
          report.audioCacheKey = keys.audioCacheKey;
          report.audioLookupKey = keys.audioLookupKey;
        } catch {
          report.audioCacheKey = cacheKey;
        }
        syncCacheKeysRef(report);

        let finalReport = report;
        let sidecarReady = await waitForSidecar(isTauriApp() ? 20_000 : 15_000);
        let sidecarStatusMsg = null;
        let sidecarStatusType = "success";
        if (sidecarReady) {
          try {
            const sidecar = await analyzeAudioViaSidecar(file, file.name);
            finalReport = mergeSidecarAnalysis(report, sidecar);
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Sidecar analyze failed";
            sidecarStatusMsg = `Heuristic report only — ${msg.slice(0, 80)}`;
            sidecarStatusType = "warning";
          }
        } else {
          sidecarStatusMsg = "Heuristic BPM/key — librosa sidecar unavailable";
          sidecarStatusType = "warning";
        }

        setAudioPreviewFromBlob(file);
        setAudioAnalysis(finalReport);
        setStatusWithTime(
          sidecarStatusMsg ??
            (finalReport.analysisEngine === "sidecar"
              ? "Track report ready (librosa tempo/key) — edit tags, then merge into Suno fields"
              : "Track report ready — edit tags, then merge into Suno fields"),
          sidecarStatusType,
        );
      } catch {
        setStatusWithTime("Audio analysis failed");
        applyAnalyzerPatch({
          notes: `Audio analysis failed. Use ${SUPPORTED_AUDIO_LABEL} in a format your browser can decode (try WAV or MP3).`,
        });
      } finally {
        if (audioContext) {
          try {
            await audioContext.close();
          } catch {}
        }
      }
    },
    [applyAnalyzerPatch, setAudioPreviewFromBlob, setStatusWithTime, syncCacheKeysRef],
  );

  useEffect(() => {
    if (!audioAnalysis) return undefined;

    const needsPeaks = analysisNeedsWaveformPeaks(audioAnalysis);
    const needsPreview = !audioPreviewUrlRef.current;
    if (!needsPeaks && !needsPreview) return undefined;

    const gen = ++rehydrateGenRef.current;
    let cancelled = false;

    (async () => {
      const resolved = await resolveAudioCacheBlob(audioAnalysis);
      if (cancelled || gen !== rehydrateGenRef.current) return;

      if (resolved?.blob) {
        try {
          if (needsPreview) setAudioPreviewFromBlob(resolved.blob);
          if (needsPeaks) {
            const peaks = await decodeWaveformPeaksFromBlob(resolved.blob);
            if (cancelled || gen !== rehydrateGenRef.current) return;
            setAudioAnalysis((prev) =>
              patchAudioAnalysis(prev, {
                waveformPeaks: peaks,
                waveformSource: "cached",
                audioCacheKey: prev?.audioCacheKey || resolved.matchedKey,
              }),
            );
          }
          return;
        } catch {
          /* fall through */
        }
      }

      if (!needsPeaks) return;

      const peaks = synthesizeWaveformPeaksFromAnalysis(audioAnalysis);
      if (cancelled || gen !== rehydrateGenRef.current) return;
      setAudioAnalysis((prev) =>
        patchAudioAnalysis(prev, { waveformPeaks: peaks, waveformSource: "estimated" }),
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [
    audioAnalysis,
    audioAnalysis?.audioCacheKey,
    audioAnalysis?.audioLookupKey,
    audioAnalysis?.duration,
    audioAnalysis?.fileName,
    audioAnalysis?.waveformPeaks,
    setAudioPreviewFromBlob,
  ]);

  useEffect(() => {
    if (!audioAnalysis) return undefined;

    const gen = ++loudnessGenRef.current;
    let cancelled = false;

    (async () => {
      setAudioLoudnessBusy(true);
      try {
        const resolved = await resolveAudioCacheBlob(audioAnalysis);
        let blob = resolved?.blob;
        if (!blob && audioPreviewUrlRef.current) {
          const res = await fetch(audioPreviewUrlRef.current);
          blob = await res.blob();
        }
        if (!blob || cancelled || gen !== loudnessGenRef.current) return;

        let stats = null;

        // Native DSP core (Tauri desktop): decode + EBU R128 in Rust straight
        // from the file bytes. Falls back to the in-browser meter on any error.
        if (isTauriApp()) {
          try {
            const native = await measureLoudnessBytes(await blob.arrayBuffer());
            stats = {
              integratedLUFS:
                typeof native.integrated_lufs === "number" ? native.integrated_lufs : NaN,
              truePeakDbTP: native.true_peak_dbtp,
              samplePeakDbFS: native.sample_peak_dbfs,
              engine: "native",
            };
          } catch {
            stats = null;
          }
        }

        if (!stats) {
          const decodeCtx = new (window.AudioContext || window.webkitAudioContext)();
          const buffer = await decodeCtx.decodeAudioData((await blob.arrayBuffer()).slice(0));
          try {
            await decodeCtx.close();
          } catch {}
          stats = await measureIntegratedLoudness(buffer);
        }

        if (!cancelled && gen === loudnessGenRef.current) {
          setAudioLoudness(stats);
        }
      } catch {
        if (!cancelled && gen === loudnessGenRef.current) setAudioLoudness(null);
      } finally {
        if (!cancelled && gen === loudnessGenRef.current) setAudioLoudnessBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    audioAnalysis,
    audioAnalysis?.audioCacheKey,
    audioAnalysis?.audioLookupKey,
    audioPreviewUrl,
  ]);

  const navigateToPolishStep = useCallback(() => {
    setGuidedStep(resolvePolishStepIndex());
  }, [setGuidedStep]);

  const applyAudioToSunoStyle = useCallback(() => {
    if (!audioAnalysis) {
      setStatusWithTime("No audio analysis yet");
      return;
    }
    applyAnalyzerPatch(buildAudioAnalyzerPatch(audioAnalysis, formatTime));

    if (promptEngine === "Suno-like") {
      navigateToPolishStep();
      setStatusWithTime("Audio DNA merged — guided path: Polish (analyzers)");
    } else {
      setStatusWithTime("Audio DNA merged into fields — switch to Suno-like to use the guided path");
    }
  }, [
    audioAnalysis,
    applyAnalyzerPatch,
    navigateToPolishStep,
    promptEngine,
    setStatusWithTime,
  ]);

  const applyImageToSunoStyle = useCallback(() => {
    if (!imageAnalysis) {
      setStatusWithTime("No image analysis yet");
      return;
    }
    applyAnalyzerPatch(buildImageAnalyzerPatch(imageAnalysis));

    if (promptEngine === "Suno-like") {
      navigateToPolishStep();
      setStatusWithTime("Image style merged — guided path: Polish (analyzers)");
    } else {
      setStatusWithTime("Image style merged into fields — switch to Suno-like to use the guided path");
    }
  }, [
    applyAnalyzerPatch,
    imageAnalysis,
    navigateToPolishStep,
    promptEngine,
    setStatusWithTime,
  ]);

  const analyzeImageFile = useCallback(
    async (file) => {
      if (!isSupportedImageFile(file)) {
        setStatusWithTime(`Use ${SUPPORTED_IMAGE_LABEL} only for image analysis`);
        applyAnalyzerPatch({
          notes: `Image analyzer accepts ${SUPPORTED_IMAGE_LABEL} (check file extension or MIME type).`,
        });
        return;
      }
      try {
        setStatusWithTime("Analyzing image...");
        const url = URL.createObjectURL(file);
        if (imagePreviewUrlRef.current) URL.revokeObjectURL(imagePreviewUrlRef.current);
        imagePreviewUrlRef.current = url;
        setImagePreview(url);
        const img = new Image();
        img.onload = () => {
          const canvas = canvasRef.current || document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          const w = 160;
          const h = Math.max(1, Math.round((img.height / img.width) * w));
          canvas.width = w;
          canvas.height = h;
          ctx.drawImage(img, 0, 0, w, h);
          const data = ctx.getImageData(0, 0, w, h).data;
          setImageAnalysis(analyzeImagePixelData(data, file.name));
          setStatusWithTime("Image ready — add to style below when you want it in Suno fields");
        };
        img.onerror = () => setStatusWithTime("Image analysis failed");
        img.src = url;
      } catch {
        setStatusWithTime("Image analysis failed");
      }
    },
    [applyAnalyzerPatch, setStatusWithTime],
  );

  const exportEnhancedAudio = useCallback(
    async (presetId, opts = {}) => {
      if (!audioAnalysis) {
        setStatusWithTime("No track loaded to export");
        return;
      }
      if (audioExportBusy) return;

      const format = normalizeStudioExportFormat(opts.format);
      const scope = opts.scope === "highlight" ? "highlight" : "full";

      setAudioExportBusy(true);
      setAudioExportProgress({ phase: "preparing", pct: 0 });
      setStatusWithTime("Studio export started…");

      try {
        const resolved = await resolveAudioCacheBlob(audioAnalysis);
        let blob = resolved?.blob;
        if (!blob && audioPreviewUrlRef.current) {
          const res = await fetch(audioPreviewUrlRef.current);
          blob = await res.blob();
        }
        if (!blob) {
          setStatusWithTime("Attach the audio file before studio export");
          return;
        }

        const baseName = String(audioAnalysis.fileName || "track").replace(/\.[^.]+$/, "");
        const suffix =
          scope === "highlight" ? `-highlight-${presetId}` : `-enhanced-${presetId}`;

        const startSec = scope === "highlight" ? Number(audioAnalysis.highlightStart) || 0 : undefined;
        const endSec =
          scope === "highlight"
            ? Number(audioAnalysis.highlightEnd) || audioAnalysis.duration || startSec + 1
            : undefined;

        const result = await exportEnhancedFromBlob(blob, presetId, `${baseName}${suffix}`, {
          format,
          startSec,
          endSec,
          onProgress: (p) => setAudioExportProgress(p),
        });

        const fmtLabel = (result?.format || format).toUpperCase();
        const fallbackNote = result?.formatFallback ? " (MP3 unavailable — saved as WAV)" : "";
        if (result?.afterLufs != null && Number.isFinite(result.afterLufs)) {
          setStatusWithTime(
            `${fmtLabel} downloaded${fallbackNote} · ${result.afterLufs.toFixed(1)} LUFS (target ${result.targetLufs})`,
          );
        } else {
          setStatusWithTime(
            scope === "highlight"
              ? `Highlight ${fmtLabel} downloaded${fallbackNote}`
              : `Enhanced ${fmtLabel} downloaded${fallbackNote}`,
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        setStatusWithTime(msg ? msg.slice(0, 80) : "Studio export failed");
      } finally {
        setAudioExportBusy(false);
        setAudioExportProgress(null);
      }
    },
    [audioAnalysis, audioExportBusy, setStatusWithTime],
  );

  const setAudioAnalysisNormalized = useCallback((value) => {
    if (!value) {
      syncCacheKeysRef(null);
      setAudioAnalysis(null);
      return;
    }
    const normalized = normalizeAudioAnalysis(value);
    syncCacheKeysRef(normalized);
    setAudioAnalysis(normalized);
  }, [syncCacheKeysRef]);

  return {
    attachAudioFile,
    analyzeAudioFile,
    analyzeImageFile,
    applyAudioToSunoStyle,
    applyImageToSunoStyle,
    audioAnalysis,
    audioExportBusy,
    audioExportProgress,
    audioLoudness,
    audioLoudnessBusy,
    audioPreviewUrl,
    canvasRef,
    exportEnhancedAudio,
    clearAudioAnalysis,
    clearImageAnalysis,
    imageAnalysis,
    imagePreview,
    resetAnalyzers,
    setAudioAnalysis: setAudioAnalysisNormalized,
    setImageAnalysis,
    sidecarAiStatus,
    updateAudioAnalysis,
  };
}
