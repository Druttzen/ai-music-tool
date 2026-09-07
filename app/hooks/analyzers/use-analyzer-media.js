"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { buildAudioSunoV55Patch, buildSunoV55StyleFromAudioAnalysis } from "../../lib/audio-to-suno-style";
import { buildImageSunoV55Patch, buildSunoV55StyleFromImageAnalysis } from "../../lib/image-to-suno-style";
import { refineSunoStyleWithLlmOrHeuristic } from "../../lib/analyzer-suno-style-llm";
import {
  isSupportedAudioFile,
  isSupportedImageFile,
  SUPPORTED_AUDIO_LABEL,
  SUPPORTED_IMAGE_LABEL,
} from "../../lib/analyzer-file-types";
import {
  audioFileMatchesAnalysis,
  deleteAudioCacheEntries,
  getAudioCacheKeysForAnalysis,
  makeAudioCacheKey,
  putAudioCacheEntries,
  resolveAudioCacheBlob,
} from "../../lib/audio-cache";
import {
  analysisNeedsWaveformPeaks,
  analyzeAudioBuffer,
  decodeWaveformPeaksFromBlob,
  formatTime,
  normalizeAudioAnalysis,
  patchAudioAnalysis,
  synthesizeWaveformPeaksFromAnalysis,
} from "../../lib/audio-analyzer";
import { getAudioAnalyzerReadyMessage } from "../../lib/analyzer-disclaimer";
import { mergeSidecarAnalysis, buildSidecarFallbackReport, mergeSonicSignature } from "../../lib/audio-analyzer-sidecar";
import { analyzeImagePixelData } from "../../lib/image-analyzer";
import { mergeSidecarImageAnalysis } from "../../lib/image-analyzer-sidecar";
import {
  analyzeAudioViaSidecar,
  analyzeImageViaSidecar,
  fetchSidecarHealth,
  fetchSonicSignatureViaSidecar,
  waitForSidecar,
} from "../../lib/sidecar-bridge";
import { measureIntegratedLoudness } from "../../lib/lufs-meter";
import { isTauriApp, measureLoudnessBytes, measureStereoPhaseBytes } from "../../lib/dsp-bridge";
import { decodeAnalyzerAudioBuffer } from "../../lib/decode-analyzer-audio";
import { measureStereoPhase } from "../../lib/stereo-phase";
import { resolvePolishStepIndex } from "../../lib/suno-guided-workflow";
import { useE2eAudioFixtures } from "./use-e2e-audio-fixtures";
import { reportCaughtError } from "../../lib/fail-safe-runtime-capture";

export function useAnalyzerMedia({
  promptEngine,
  setGuidedStep,
  applyAnalyzerPatch,
  setStatusWithTime,
  coProducerLlmSettings = null,
  refs,
}) {
  const analyzerMergeGenerationRef = useRef(0);
  const analyzerMergeAbortRef = useRef(null);
  const imageAnalysisGenerationRef = useRef(0);
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

  const [audioAnalysis, setAudioAnalysis] = useState(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState(null);
  const [audioLoudness, setAudioLoudness] = useState(null);
  const [audioLoudnessBusy, setAudioLoudnessBusy] = useState(false);
  const [audioStereoPhase, setAudioStereoPhase] = useState(null);
  const [imageAnalysis, setImageAnalysis] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [analyzeAudioBusy, setAnalyzeAudioBusy] = useState(false);
  const [analyzeImageBusy, setAnalyzeImageBusy] = useState(false);

  const cancelAnalyzerStyleMerge = useCallback(() => {
    analyzerMergeGenerationRef.current += 1;
    analyzerMergeAbortRef.current?.abort();
    analyzerMergeAbortRef.current = null;
  }, []);

  useEffect(() => cancelAnalyzerStyleMerge, [cancelAnalyzerStyleMerge]);

  useEffect(
    () => () => {
      imageAnalysisGenerationRef.current += 1;
      if (imagePreviewUrlRef.current) {
        URL.revokeObjectURL(imagePreviewUrlRef.current);
        imagePreviewUrlRef.current = null;
      }
    },
    [imagePreviewUrlRef],
  );

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

  const reset = useCallback(() => {
    cancelAnalyzerStyleMerge();
    deleteAudioCacheEntries(audioCacheKeysRef.current);
    audioCacheKeysRef.current = [];
    audioCacheKeyRef.current = null;
    setAudioAnalysis(null);
    setAudioPreviewUrl(null);
    setAudioLoudness(null);
    setAudioStereoPhase(null);
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
  }, [audioCacheKeyRef, audioCacheKeysRef, audioPreviewUrlRef, cancelAnalyzerStyleMerge, imagePreviewUrlRef]);

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
    setAudioStereoPhase(null);
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
        const decoded = await decodeAnalyzerAudioBuffer(arrayBuffer, file.name);
        audioContext = decoded.audioContext;
        const buffer = decoded.buffer;

        if (!audioFileMatchesAnalysis(file, audioAnalysis, buffer.duration)) {
          setStatusWithTime("File name/duration does not match this report — drop as new analysis instead");
          return;
        }

        const cacheKey = makeAudioCacheKey(file);
        const keys = await putAudioCacheEntries(file, cacheKey, buffer.duration);
        const peaksBlob = decoded.previewBlob || file;
        const peaks = await decodeWaveformPeaksFromBlob(peaksBlob);

        setAudioPreviewFromBlob(decoded.previewBlob || file);
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
        setStatusWithTime(
          decoded.engine === "native"
            ? "Audio attached via Symphonia (ALAC/CAF/codec unsupported in Web Audio)"
            : "Audio attached — sample-accurate waveform and playback restored",
        );
      } catch (err) {
        reportCaughtError("analyzers.attachAudioFile", err);
        const msg = err instanceof Error ? err.message : "";
        setStatusWithTime(msg ? msg.slice(0, 100) : "Could not attach audio file");
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
        const decoded = await decodeAnalyzerAudioBuffer(arrayBuffer, file.name);
        audioContext = decoded.audioContext;
        const buffer = decoded.buffer;
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
        let sidecarReady = await waitForSidecar(45_000);
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

        if (decoded.engine === "native" && !sidecarStatusMsg) {
          sidecarStatusMsg = "Decoded via Symphonia (browser codec missing) — track report ready";
          sidecarStatusType = "success";
        } else if (decoded.engine === "native" && sidecarStatusMsg) {
          sidecarStatusMsg = `${sidecarStatusMsg} · Symphonia preview decode`;
        }

        setAudioPreviewFromBlob(decoded.previewBlob || file);
        setAudioAnalysis(finalReport);
        setStatusWithTime(
          sidecarStatusMsg ?? getAudioAnalyzerReadyMessage(finalReport),
          sidecarStatusType,
        );
      } catch (decodeErr) {
        const sidecarReady = await waitForSidecar(45_000);
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
            reportCaughtError("analyzers.analyzeAudioFile", sidecarErr);
            const msg = sidecarErr instanceof Error ? sidecarErr.message : "Sidecar analyze failed";
            setStatusWithTime(`Audio analysis failed — ${msg.slice(0, 80)}`, "error");
            applyAnalyzerPatch({
              notes: `Decode failed (${decodeErr instanceof Error ? decodeErr.message : "unknown"}). Sidecar fallback also failed.`,
            });
            return;
          }
        }
        setStatusWithTime(
          decodeErr instanceof Error ? decodeErr.message.slice(0, 100) : "Audio analysis failed",
        );
        applyAnalyzerPatch({
          notes: `Audio analysis failed. Use ${SUPPORTED_AUDIO_LABEL}. ALAC/CAF needs Studio Symphonia decode; FLAC may need the librosa sidecar in browser.`,
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
          let previewBlob = resolved.blob;
          let peaksBlob = resolved.blob;
          // ALAC/CAF cache blobs need Symphonia→WAV again after reload for Web Audio playback.
          try {
            const arrayBuffer = await resolved.blob.arrayBuffer();
            const decoded = await decodeAnalyzerAudioBuffer(
              arrayBuffer,
              audioAnalysis.fileName || "track",
            );
            if (decoded.previewBlob) {
              previewBlob = decoded.previewBlob;
              peaksBlob = decoded.previewBlob;
            }
            if (decoded.audioContext) {
              try {
                await decoded.audioContext.close();
              } catch {
                /* ignore */
              }
            }
          } catch {
            /* keep original blob for browser-decodable formats */
          }
          if (cancelled || gen !== rehydrateGenRef.current) return;
          if (needsPreview) setAudioPreviewFromBlob(previewBlob);
          if (needsPeaks) {
            const peaks = await decodeWaveformPeaksFromBlob(peaksBlob);
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
        let phaseStats = null;
        const arrayBuffer = await blob.arrayBuffer();

        // Native dsp-core Symphonia (Tauri): decode + EBU R128 / phase from file bytes.
        // Falls back to Web Audio + JS meters on any error or outside Studio.
        if (isTauriApp()) {
          try {
            const native = await measureLoudnessBytes(arrayBuffer.slice(0));
            stats = {
              integratedLUFS:
                typeof native.integrated_lufs === "number" ? native.integrated_lufs : NaN,
              truePeakDbTP: native.true_peak_dbtp,
              samplePeakDbFS: native.sample_peak_dbfs,
              shortTermLUFS:
                typeof native.short_term_lufs === "number" ? native.short_term_lufs : null,
              momentaryLUFS:
                typeof native.momentary_lufs === "number" ? native.momentary_lufs : null,
              engine: "native",
            };
          } catch {
            stats = null;
          }
          try {
            const nativePhase = await measureStereoPhaseBytes(arrayBuffer.slice(0));
            phaseStats = {
              correlation: nativePhase.correlation,
              leftPeak: nativePhase.left_peak,
              rightPeak: nativePhase.right_peak,
              monoPeak: nativePhase.mono_peak,
              monoCancelDb: nativePhase.mono_cancel_db,
              outOfPhase: nativePhase.out_of_phase,
              engine: "native",
            };
          } catch {
            phaseStats = null;
          }
        }

        if (!stats || !phaseStats) {
          const decodeCtx = new (window.AudioContext || window.webkitAudioContext)();
          try {
            const buffer = await decodeCtx.decodeAudioData(arrayBuffer.slice(0));
            if (!stats) {
              stats = await measureIntegratedLoudness(buffer);
            }
            if (!phaseStats) {
              phaseStats = measureStereoPhase(buffer);
            }
          } finally {
            try {
              await decodeCtx.close();
            } catch {
              /* ignore */
            }
          }
        }

        if (!cancelled && gen === loudnessGenRef.current) {
          setAudioLoudness(stats);
          setAudioStereoPhase(phaseStats);
        }
      } catch {
        if (!cancelled && gen === loudnessGenRef.current) {
          setAudioLoudness(null);
          setAudioStereoPhase(null);
        }
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

  const refineCurrentAnalyzerStyle = useCallback(
    async (kind, heuristic, report) => {
      analyzerMergeAbortRef.current?.abort();
      const controller = new AbortController();
      const generation = analyzerMergeGenerationRef.current + 1;
      analyzerMergeGenerationRef.current = generation;
      analyzerMergeAbortRef.current = controller;

      const built = await refineSunoStyleWithLlmOrHeuristic(
        kind,
        heuristic,
        report,
        coProducerLlmSettings,
        { signal: controller.signal },
      );
      if (controller.signal.aborted || generation !== analyzerMergeGenerationRef.current) {
        return null;
      }
      if (analyzerMergeAbortRef.current === controller) {
        analyzerMergeAbortRef.current = null;
      }
      return built;
    },
    [coProducerLlmSettings],
  );

  const applyAudioToSunoStyle = useCallback(async ({ announce = true, navigate = true } = {}) => {
    if (!audioAnalysis) {
      setStatusWithTime("No audio analysis yet");
      return;
    }
    const heuristic = buildSunoV55StyleFromAudioAnalysis(audioAnalysis);
    const built = await refineCurrentAnalyzerStyle(
      "audio",
      heuristic,
      audioAnalysis,
    );
    if (!built) return;
    applyAnalyzerPatch(buildAudioSunoV55Patch(audioAnalysis, formatTime, built));

    const via = built.source === "llm" ? " (LLM refined)" : "";
    if (promptEngine === "Suno-like") {
      if (navigate) navigateToPolishStep();
      if (announce) {
        setStatusWithTime(`Audio → Suno v5.5 Style merged${via} — guided path: Polish`);
      }
    } else if (announce) {
      setStatusWithTime(`Audio → Suno v5.5 Style merged${via} — Style buffer filled`);
    }
  }, [
    audioAnalysis,
    applyAnalyzerPatch,
    navigateToPolishStep,
    promptEngine,
    refineCurrentAnalyzerStyle,
    setStatusWithTime,
  ]);

  const applyImageToSunoStyle = useCallback(async () => {
    if (!imageAnalysis) {
      setStatusWithTime("No image analysis yet");
      return;
    }
    const heuristic = buildSunoV55StyleFromImageAnalysis(imageAnalysis);
    const built = await refineCurrentAnalyzerStyle(
      "image",
      heuristic,
      imageAnalysis,
    );
    if (!built) return;
    applyAnalyzerPatch(buildImageSunoV55Patch(imageAnalysis, built));

    const via = built.source === "llm" ? " (LLM refined)" : "";
    if (promptEngine === "Suno-like") {
      navigateToPolishStep();
      setStatusWithTime(`Image → Suno v5.5 Style merged${via} — guided path: Polish`);
    } else {
      setStatusWithTime(`Image → Suno v5.5 Style merged${via} — Style buffer filled`);
    }
  }, [
    applyAnalyzerPatch,
    imageAnalysis,
    navigateToPolishStep,
    promptEngine,
    refineCurrentAnalyzerStyle,
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
      const generation = ++imageAnalysisGenerationRef.current;
      const isCurrent = () => imageAnalysisGenerationRef.current === generation;
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
        if (!isCurrent()) return;

        let finalReport = pixelReport;
        let sidecarStatusMsg = null;
        let sidecarStatusType = "success";
        const sidecarReady = await waitForSidecar(45_000);
        if (!isCurrent()) return;
        const health = sidecarReady ? await fetchSidecarHealth() : null;
        if (!isCurrent()) return;
        if (sidecarReady && health?.vision_available) {
          try {
            const sidecar = await analyzeImageViaSidecar(file, file.name, { caption: true });
            if (!isCurrent()) return;
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
    [
      analyzeImageBusy,
      applyAnalyzerPatch,
      canvasRef,
      imagePreviewUrlRef,
      setStatusWithTime,
    ],
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
    analyzeAudioFile,
    analyzeImageFile,
    applyAudioToSunoStyle,
    applyImageToSunoStyle,
    attachAudioFile,
    audioAnalysis,
    audioLoudness,
    audioLoudnessBusy,
    audioPreviewUrl,
    audioPreviewUrlRef,
    audioStereoPhase,
    cancelAnalyzerStyleMerge,
    canvasRef,
    clearAudioAnalysis,
    clearImageAnalysis,
    imageAnalysis,
    imagePreview,
    reset,
    setAudioAnalysis,
    setAudioAnalysisNormalized,
    setAudioPreviewFromBlob,
    setImageAnalysis,
    syncCacheKeysRef,
    updateAudioAnalysis,
  };
}
