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
import { mergeSidecarAnalysis, buildSidecarFallbackReport } from "../lib/audio-analyzer-sidecar";
import { analyzeImagePixelData } from "../lib/image-analyzer";
import { mergeSidecarImageAnalysis } from "../lib/image-analyzer-sidecar";
import { analyzeAudioViaSidecar, analyzeImageViaSidecar, downloadSidecarStem, fetchSidecarHealth, generateMusicViaSidecar, getManagedSidecarStatus, isSidecarAvailable, resetSidecarHealthCache, separateStemsViaSidecar, waitForSidecar } from "../lib/sidecar-bridge";
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
  const audioAnalysisRef = useRef(null);
  const [imageAnalysis, setImageAnalysis] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const canvasRef = useRef(null);
  const imagePreviewUrlRef = useRef(null);
  const audioPreviewUrlRef = useRef(null);
  const rehydrateGenRef = useRef(0);
  const audioCacheKeyRef = useRef(null);
  const audioCacheKeysRef = useRef([]);
  const [sidecarAiStatus, setSidecarAiStatus] = useState("checking");
  const [sidecarGenerateAvailable, setSidecarGenerateAvailable] = useState(false);
  const [stemSeparationBusy, setStemSeparationBusy] = useState(false);
  const [stemSeparationStems, setStemSeparationStems] = useState([]);
  const [generateMusicBusy, setGenerateMusicBusy] = useState(false);

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
          try {
            const health = await fetchSidecarHealth();
            if (!cancelled) {
              setSidecarGenerateAvailable(!!health?.generate_available);
            }
          } catch {
            if (!cancelled) setSidecarGenerateAvailable(false);
          }
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
        if (!cancelled) setSidecarGenerateAvailable(false);
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
    setStemSeparationStems([]);
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
            (finalReport.analysisEngine === "sidecar+hf-genre"
              ? "Track report ready (librosa + HF genre) — edit tags, then merge into Suno fields"
              : finalReport.analysisEngine === "sidecar"
                ? "Track report ready (librosa tempo/key) — edit tags, then merge into Suno fields"
                : "Track report ready — edit tags, then merge into Suno fields"),
          sidecarStatusType,
        );
      } catch (decodeErr) {
        const sidecarReady = await waitForSidecar(isTauriApp() ? 20_000 : 15_000);
        if (sidecarReady) {
          try {
            const sidecar = await analyzeAudioViaSidecar(file, file.name);
            const fallback = buildSidecarFallbackReport(file.name, sidecar);
            const finalReport = mergeSidecarAnalysis(fallback, sidecar);
            const cacheKey = makeAudioCacheKey(file);
            finalReport.audioCacheKey = cacheKey;
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
    audioAnalysisRef.current = audioAnalysis;
  }, [audioAnalysis]);

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
  }, [loudnessSourceKey]);

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
          sidecarStatusMsg = "Palette-only — install sidecar[vision] for BLIP captions";
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
    async (prompt, durationSec = 10) => {
      const text = String(prompt || "").trim();
      if (!text) {
        setStatusWithTime("Enter a MusicGen prompt first", "warning");
        return;
      }
      if (generateMusicBusy) return;

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
            "MusicGen not installed — run npm run sidecar:generate (CC-BY-NC weights)",
            "warning",
          );
          setSidecarGenerateAvailable(false);
          return;
        }
        const { blob, model, durationSec: dur } = await generateMusicViaSidecar(text, durationSec);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `musicgen-preview-${Date.now()}.wav`;
        a.click();
        URL.revokeObjectURL(url);
        setStatusWithTime(
          `MusicGen preview downloaded (${model || "musicgen"} · ${dur || durationSec}s)`,
          "success",
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "MusicGen generation failed";
        setStatusWithTime(msg.slice(0, 120), "warning");
      } finally {
        setGenerateMusicBusy(false);
      }
    },
    [generateMusicBusy, setStatusWithTime],
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
