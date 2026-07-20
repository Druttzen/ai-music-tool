"use client";

import { useCallback, useEffect, useState } from "react";
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
import { getAudioAnalyzerReadyMessage } from "../lib/analyzer-disclaimer";
import { mergeSidecarAnalysis, buildSidecarFallbackReport, mergeSonicSignature } from "../lib/audio-analyzer-sidecar";
import { buildMusicGenAnalysisReport, downloadMusicGenBlob, enrichMusicGenReportWithSidecar } from "../lib/musicgen-preview";
import {
  hasMeaningfulHighlightRange,
  sliceAudioBlobToHighlightRange,
} from "../lib/audio-highlight-slice";
import { analyzeImagePixelData } from "../lib/image-analyzer";
import { mergeSidecarImageAnalysis } from "../lib/image-analyzer-sidecar";
import { analyzeAudioViaSidecar, analyzeImageViaSidecar, downloadSidecarStem, fetchSidecarHealth, fetchSonicSignatureViaSidecar, generateMusicViaSidecar, generateMusicWithMelodyViaSidecar, separateStemsViaSidecar, waitForSidecar } from "../lib/sidecar-bridge";
import { musicGenInstallHint } from "../lib/sidecar-capabilities";
import { measureIntegratedLoudness } from "../lib/lufs-meter";
import { isTauriApp, measureLoudnessBytes } from "../lib/dsp-bridge";
import { normalizeStudioExportFormat } from "../lib/audio-export-formats";
import { exportEnhancedFromBlob } from "../lib/studio-export-client";
import { resolvePolishStepIndex } from "../lib/suno-guided-workflow";
import { useAnalyzerRefs } from "./analyzers/use-analyzer-refs";
import { useE2eAudioFixtures } from "./analyzers/use-e2e-audio-fixtures";
import { useSidecarStatus } from "./analyzers/use-sidecar-status";
import {
  deriveCanvasMotionHint,
  deriveCanvasTrackMeta,
  openImageInCanvasTool,
} from "../lib/suite-canvas-client";

export function useAnalyzers({
  promptEngine,
  setGuidedStep,
  applyAnalyzerPatch,
  setStatusWithTime,
  idea = "",
  lyricTheme = "",
}) {
  const refs = useAnalyzerRefs();
  const {
    audioAnalysisRef,
    audioCacheKeyRef,
    audioCacheKeysRef,
    audioPreviewUrlRef,
    canvasRef,
    imagePreviewUrlRef,
    loudnessGenRef,
    rehydrateGenRef,
    setAudioPreviewFromBlob: setPreviewFromBlob,
  } = refs;

  const { sidecarAiStatus, sidecarGenerateAvailable, setSidecarGenerateAvailable } =
    useSidecarStatus();

  const [audioAnalysis, setAudioAnalysis] = useState(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState(null);
  const [audioExportBusy, setAudioExportBusy] = useState(false);
  const [audioExportProgress, setAudioExportProgress] = useState(null);
  const [audioLoudness, setAudioLoudness] = useState(null);
  const [audioLoudnessBusy, setAudioLoudnessBusy] = useState(false);
  const [imageAnalysis, setImageAnalysis] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [stemSeparationBusy, setStemSeparationBusy] = useState(false);
  const [stemSeparationStems, setStemSeparationStems] = useState([]);
  const [generateMusicBusy, setGenerateMusicBusy] = useState(false);
  const [analyzeAudioBusy, setAnalyzeAudioBusy] = useState(false);
  const [analyzeImageBusy, setAnalyzeImageBusy] = useState(false);

  useE2eAudioFixtures(setAudioAnalysis);

  const setAudioPreviewFromBlob = useCallback(
    (blob) => {
      setAudioPreviewUrl(setPreviewFromBlob(blob));
    },
    [setPreviewFromBlob],
  );

  const syncCacheKeysRef = useCallback((report) => {
    audioCacheKeysRef.current = report ? getAudioCacheKeysForAnalysis(report) : [];
    audioCacheKeyRef.current = report?.audioCacheKey || null;
  }, [audioCacheKeyRef, audioCacheKeysRef]);

  const resetAnalyzers = useCallback(() => {
    deleteAudioCacheEntries(audioCacheKeysRef.current);
    audioCacheKeysRef.current = [];
    audioCacheKeyRef.current = null;
    setAudioAnalysis(null);
    setAudioPreviewUrl(null);
    setAudioLoudness(null);
    setImageAnalysis(null);
    setImagePreview(null);
    setStemSeparationStems([]);
    if (imagePreviewUrlRef.current) {
      URL.revokeObjectURL(imagePreviewUrlRef.current);
      imagePreviewUrlRef.current = null;
    }
    if (audioPreviewUrlRef.current) {
      URL.revokeObjectURL(audioPreviewUrlRef.current);
      audioPreviewUrlRef.current = null;
    }
  }, [audioCacheKeyRef, audioCacheKeysRef, audioPreviewUrlRef, imagePreviewUrlRef]);

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
  }, [audioCacheKeyRef, audioCacheKeysRef, audioPreviewUrlRef]);

  const clearImageAnalysis = useCallback(() => {
    setImageAnalysis(null);
    setImagePreview(null);
    if (imagePreviewUrlRef.current) {
      URL.revokeObjectURL(imagePreviewUrlRef.current);
      imagePreviewUrlRef.current = null;
    }
  }, [imagePreviewUrlRef]);

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
        setAudioAnalysis((prev) => {
          const next = patchAudioAnalysis(prev, {
            audioCacheKey: keys.audioCacheKey,
            audioLookupKey: keys.audioLookupKey,
            waveformPeaks: peaks,
            waveformSource: "sample",
            duration: buffer.duration,
          });
          syncCacheKeysRef(next);
          return next;
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
      if (analyzeAudioBusy) {
        setStatusWithTime("Audio analysis already in progress", "info");
        return;
      }
      if (!isSupportedAudioFile(file)) {
        setStatusWithTime(`Use ${SUPPORTED_AUDIO_LABEL} only for audio analysis`);
        applyAnalyzerPatch({
          notes: `Audio analyzer accepts ${SUPPORTED_AUDIO_LABEL} (check file extension or MIME type).`,
        });
        return;
      }

      let audioContext = null;
      setAnalyzeAudioBusy(true);
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
            try {
              const sonic = await fetchSonicSignatureViaSidecar(file, file.name);
              finalReport = mergeSonicSignature(finalReport, sonic);
            } catch {
              /* sonic signature optional */
            }
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
          sidecarStatusMsg ?? getAudioAnalyzerReadyMessage(finalReport),
          sidecarStatusType,
        );
      } catch (decodeErr) {
        const sidecarReady = await waitForSidecar(isTauriApp() ? 20_000 : 15_000);
        if (sidecarReady) {
          try {
            const sidecar = await analyzeAudioViaSidecar(file, file.name);
            const fallback = buildSidecarFallbackReport(file.name, sidecar);
            let finalReport = mergeSidecarAnalysis(fallback, sidecar);
            try {
              const sonic = await fetchSonicSignatureViaSidecar(file, file.name);
              finalReport = mergeSonicSignature(finalReport, sonic);
            } catch {
              /* optional */
            }
            const cacheKey = makeAudioCacheKey(file);
            try {
              const keys = await putAudioCacheEntries(
                file,
                cacheKey,
                finalReport.duration || sidecar.duration_sec || 0,
              );
              finalReport.audioCacheKey = keys.audioCacheKey;
              finalReport.audioLookupKey = keys.audioLookupKey;
            } catch {
              finalReport.audioCacheKey = cacheKey;
            }
            syncCacheKeysRef(finalReport);
            setAudioPreviewFromBlob(file);
            setAudioAnalysis(finalReport);
            setStatusWithTime(
              "Track report ready via librosa sidecar (browser could not decode this codec)",
              "warning",
            );
            return;
          } catch (sidecarErr) {
            const msg = sidecarErr instanceof Error ? sidecarErr.message : "Sidecar analyze failed";
            setStatusWithTime(`Audio analysis failed — ${msg.slice(0, 80)}`, "error");
            applyAnalyzerPatch({
              notes: `Decode failed (${decodeErr instanceof Error ? decodeErr.message : "unknown"}). Sidecar fallback also failed.`,
            });
            return;
          }
        }
        setStatusWithTime("Audio analysis failed");
        applyAnalyzerPatch({
          notes: `Audio analysis failed. Use ${SUPPORTED_AUDIO_LABEL} in a format your browser can decode, or start the librosa sidecar for FLAC.`,
        });
      } finally {
        setAnalyzeAudioBusy(false);
        if (audioContext) {
          try {
            await audioContext.close();
          } catch {}
        }
      }
    },
    [analyzeAudioBusy, applyAnalyzerPatch, setAudioPreviewFromBlob, setStatusWithTime, syncCacheKeysRef],
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
    audioPreviewUrlRef,
    rehydrateGenRef,
    setAudioPreviewFromBlob,
  ]);

  useEffect(() => {
    audioAnalysisRef.current = audioAnalysis;
  }, [audioAnalysis, audioAnalysisRef]);

  // Re-measure loudness only when the underlying audio source changes — keyed
  // on cache/lookup keys + preview url, NOT on the whole analysis object. This
  // prevents a full blob decode + EBU R128 re-measurement when an unrelated
  // patch (e.g. rehydrated waveform peaks) changes the analysis object identity.
  const loudnessSourceKey = audioAnalysis
    ? `${audioAnalysis.audioCacheKey || ""}|${audioAnalysis.audioLookupKey || ""}|${audioPreviewUrl || ""}`
    : "";

  useEffect(() => {
    if (!loudnessSourceKey) return undefined;
    const analysis = audioAnalysisRef.current;
    if (!analysis) return undefined;

    const gen = ++loudnessGenRef.current;
    let cancelled = false;

    (async () => {
      setAudioLoudnessBusy(true);
      try {
        const resolved = await resolveAudioCacheBlob(analysis);
        let blob = resolved?.blob;
        if (!blob && audioPreviewUrlRef.current) {
          const res = await fetch(audioPreviewUrlRef.current);
          if (res.ok) blob = await res.blob();
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
  }, [loudnessSourceKey, audioAnalysisRef, audioPreviewUrlRef, loudnessGenRef]);

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
      if (analyzeImageBusy) {
        setStatusWithTime("Image analysis already in progress", "info");
        return;
      }
      if (!isSupportedImageFile(file)) {
        setStatusWithTime(`Use ${SUPPORTED_IMAGE_LABEL} only for image analysis`);
        applyAnalyzerPatch({
          notes: `Image analyzer accepts ${SUPPORTED_IMAGE_LABEL} (check file extension or MIME type).`,
        });
        return;
      }
      setAnalyzeImageBusy(true);
      try {
        setStatusWithTime("Analyzing image...");
        const url = URL.createObjectURL(file);
        if (imagePreviewUrlRef.current) URL.revokeObjectURL(imagePreviewUrlRef.current);
        imagePreviewUrlRef.current = url;
        setImagePreview(url);

        const pixelReport = await new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            try {
              const canvas = canvasRef.current || document.createElement("canvas");
              const ctx = canvas.getContext("2d");
              const w = 160;
              const h = Math.max(1, Math.round((img.height / img.width) * w));
              canvas.width = w;
              canvas.height = h;
              ctx.drawImage(img, 0, 0, w, h);
              const data = ctx.getImageData(0, 0, w, h).data;
              resolve(analyzeImagePixelData(data, file.name));
            } catch (err) {
              reject(err);
            }
          };
          img.onerror = () => reject(new Error("image decode failed"));
          img.src = url;
        });

        let finalReport = pixelReport;
        let sidecarStatusMsg = null;
        let sidecarStatusType = "success";
        const sidecarReady = await waitForSidecar(isTauriApp() ? 20_000 : 15_000);
        const health = sidecarReady ? await fetchSidecarHealth() : null;
        if (sidecarReady && health?.vision_available) {
          try {
            const sidecar = await analyzeImageViaSidecar(file, file.name, { caption: true });
            finalReport = mergeSidecarImageAnalysis(pixelReport, sidecar);
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Sidecar image analyze failed";
            sidecarStatusMsg = `Palette report only — ${msg.slice(0, 80)}`;
            sidecarStatusType = "warning";
          }
        } else if (!sidecarReady) {
          sidecarStatusMsg = "Palette-only — vision sidecar unavailable";
          sidecarStatusType = "warning";
        } else if (!health?.vision_available) {
          sidecarStatusMsg = "Palette-only — npm run sidecar:vision for BLIP captions";
          sidecarStatusType = "warning";
        }

        setImageAnalysis(finalReport);
        setStatusWithTime(
          sidecarStatusMsg ??
            (finalReport.analysisEngine === "pixel+blip"
              ? "Image ready (palette + BLIP caption) — add to style below when you want it in Suno fields"
              : "Image ready — add to style below when you want it in Suno fields"),
          sidecarStatusType,
        );
      } catch {
        setStatusWithTime("Image analysis failed");
      } finally {
        setAnalyzeImageBusy(false);
      }
    },
    [analyzeImageBusy, applyAnalyzerPatch, canvasRef, imagePreviewUrlRef, setStatusWithTime],
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
          if (res.ok) blob = await res.blob();
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
    [audioAnalysis, audioExportBusy, audioPreviewUrlRef, setStatusWithTime],
  );

  const separateStems = useCallback(
    async (stemName = null) => {
      if (!audioAnalysis) {
        setStatusWithTime("No track loaded for stem separation");
        return;
      }
      if (stemSeparationBusy) return;

      setStemSeparationBusy(true);
      setStemSeparationStems([]);
      try {
        setStatusWithTime("Demucs stem separation started…");
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
        const result = await separateStemsViaSidecar(blob, audioAnalysis.fileName || "track.wav");
        setStemSeparationStems(result.stems || []);
        if (stemName) {
          const stem = result.stems.find((s) => s.name === stemName);
          if (stem) {
            const base = String(audioAnalysis.fileName || "track").replace(/\.[^.]+$/, "");
            await downloadSidecarStem(stem.download_url, `${base}-${stem.filename}`);
            setStatusWithTime(`Downloaded ${stem.name} stem`);
            return;
          }
        }
        setStatusWithTime(
          `Stems ready (${result.sources.join(", ")}) — download individual WAVs below`,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Stem separation failed";
        setStatusWithTime(msg.slice(0, 100), "warning");
      } finally {
        setStemSeparationBusy(false);
      }
    },
    [audioAnalysis, setStatusWithTime, stemSeparationBusy],
  );

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
            setStatusWithTime(
              `MusicGen preview merged into Suno fields (${model || "musicgen"} · ${resolvedDuration}s${mode === "melody" ? " · melody" : ""}${highlightNote})`,
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
        const msg = err instanceof Error ? err.message : "MusicGen generation failed";
        setStatusWithTime(msg.slice(0, 120), "warning");
      } finally {
        setGenerateMusicBusy(false);
      }
    },
    [applyAnalyzerPatch, generateMusicBusy, navigateToPolishStep, promptEngine, audioAnalysis, audioPreviewUrlRef, setAudioPreviewFromBlob, setSidecarGenerateAvailable, setStatusWithTime, syncCacheKeysRef],
  );

  const downloadStem = useCallback(
    async (stem) => {
      if (!stem?.download_url || !audioAnalysis) return;
      const base = String(audioAnalysis.fileName || "track").replace(/\.[^.]+$/, "");
      try {
        await downloadSidecarStem(stem.download_url, `${base}-${stem.filename}`);
        setStatusWithTime(`Downloaded ${stem.name} stem`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Stem download failed";
        setStatusWithTime(msg.slice(0, 80), "warning");
      }
    },
    [audioAnalysis, setStatusWithTime],
  );

  const openInCanvasTool = useCallback(async () => {
    if (!imagePreview) {
      setStatusWithTime("Drop an image first to open in Canvas Tool");
      return;
    }
    try {
      setStatusWithTime("Opening AI Canvas Tool…");
      const { title, artist } = deriveCanvasTrackMeta({
        idea,
        lyricTheme,
        audioAnalysis,
        imageAnalysis,
      });
      const motionHint = deriveCanvasMotionHint(imageAnalysis);
      const ext = (imageAnalysis?.fileName || "").split(".").pop() || "png";
      const audioExt = (audioAnalysis?.fileName || "").split(".").pop() || "mp3";
      const result = await openImageInCanvasTool({
        imagePreviewUrl: imagePreview,
        audioPreviewUrl: audioPreviewUrl || undefined,
        title,
        artist,
        motionHint,
        ext,
        audioExt,
      });
      if (result?.ok) {
        setStatusWithTime(
          result.launched
            ? audioPreviewUrl
              ? "AI Canvas Tool opened — artwork + track imported"
              : "AI Canvas Tool opened — artwork imported"
            : "Artwork exported — exports opened. Install AI Canvas Tool to launch automatically",
        );
      } else {
        setStatusWithTime(result?.error || "Could not open Canvas Tool", "error");
      }
    } catch (err) {
      setStatusWithTime(
        err instanceof Error ? err.message : "Could not open Canvas Tool",
        "error",
      );
    }
  }, [
    audioAnalysis,
    audioPreviewUrl,
    idea,
    imageAnalysis,
    imagePreview,
    lyricTheme,
    setStatusWithTime,
  ]);

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
    downloadStem,
    generateMusicBusy,
    generateMusicFromPrompt,
    imageAnalysis,
    imagePreview,
    openInCanvasTool,
    resetAnalyzers,
    setAudioAnalysis: setAudioAnalysisNormalized,
    setImageAnalysis,
    separateStems,
    sidecarAiStatus,
    sidecarGenerateAvailable,
    stemSeparationBusy,
    stemSeparationStems,
    updateAudioAnalysis,
  };
}
