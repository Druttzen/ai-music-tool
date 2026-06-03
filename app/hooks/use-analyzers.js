"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyMoodPatch,
  compactAudioStyleRule,
  compactImageStyleRule,
  mergeAnalyzerRuleLine,
  mergeGuidedGenres,
  mergeGuidedRhythms,
  mergeGuidedSounds,
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
import { sliceAudioBuffer } from "../lib/audio-buffer-serialize";
import { measureIntegratedLoudness } from "../lib/lufs-meter";
import { exportEnhancedInWorker } from "../lib/studio-export-client";
import { getGuidedPolishStepIndex, getStepCount } from "../lib/suno-guided-workflow";

export function useAnalyzers({
  promptEngine,
  setGuidedStep,
  setIdea,
  setMood,
  setNotes,
  setRules,
  setSelectedGenres,
  setSelectedRhythms,
  setSelectedSounds,
  setStatusWithTime,
  setTempo,
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
        setNotes(`Audio analyzer accepts ${SUPPORTED_AUDIO_LABEL} (check file extension or MIME type).`);
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

        setAudioPreviewFromBlob(file);
        setAudioAnalysis(report);
        setStatusWithTime("Track report ready — edit tags, then merge into Suno fields");
      } catch {
        setStatusWithTime("Audio analysis failed");
        setNotes(
          `Audio analysis failed. Use ${SUPPORTED_AUDIO_LABEL} in a format your browser can decode (try WAV or MP3).`,
        );
      } finally {
        if (audioContext) {
          try {
            await audioContext.close();
          } catch {}
        }
      }
    },
    [setAudioPreviewFromBlob, setNotes, setStatusWithTime, syncCacheKeysRef],
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

        const decodeCtx = new (window.AudioContext || window.webkitAudioContext)();
        const buffer = await decodeCtx.decodeAudioData((await blob.arrayBuffer()).slice(0));
        try {
          await decodeCtx.close();
        } catch {}

        const stats = await measureIntegratedLoudness(buffer);
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

  const applyAudioToSunoStyle = useCallback(() => {
    if (!audioAnalysis) {
      setStatusWithTime("No audio analysis yet");
      return;
    }
    setTempo(audioAnalysis.estimatedBpm);

    const genreTags = [
      ...(audioAnalysis.suggestedGenres || []),
      ...(audioAnalysis.suggestedSubgenres || []),
    ];
    if (genreTags.length) {
      setSelectedGenres((g) => mergeGuidedGenres(g, genreTags));
    }

    const soundTags = [
      ...(audioAnalysis.suggestedSounds || []),
      ...(audioAnalysis.suggestedInstruments || []),
    ];
    setSelectedSounds((s) => mergeGuidedSounds(s, soundTags));
    setSelectedRhythms((r) => mergeGuidedRhythms(r, audioAnalysis.suggestedRhythms));
    if (audioAnalysis.moodSuggestion) {
      setMood((m) => applyMoodPatch(m, audioAnalysis.moodSuggestion));
    }
    setRules((prev) => mergeAnalyzerRuleLine(prev, "audio", compactAudioStyleRule(audioAnalysis)));

    const summary = (audioAnalysis.trackSummary || "").trim();
    const hiLabel = audioAnalysis.highlightLabel || "section";
    const hiRange = `${formatTime(audioAnalysis.highlightStart)}–${formatTime(audioAnalysis.highlightEnd)}`;

    if (summary) {
      setIdea((prev) => {
        const p = (prev || "").trim();
        const add = `Reference track (highlight ${hiRange}): ${summary}`;
        if (!p) return add;
        if (/reference track/i.test(p)) return p;
        if (p.length < 140) return `${p}. ${add}`;
        return p;
      });

      setNotes((prev) => {
        const block = `Audio highlight (${hiRange}, ${hiLabel}):\n${summary}`;
        const p = (prev || "").trim();
        if (!p) return block;
        if (p.includes("Audio highlight (")) return p;
        return `${p}\n\n${block}`;
      });
    }

    if (promptEngine === "Suno-like") {
      setGuidedStep(() => {
        const max = getStepCount() - 1;
        const polish = getGuidedPolishStepIndex();
        return Math.min(max, Math.max(0, polish));
      });
      setStatusWithTime("Audio DNA merged — guided path: Polish (analyzers)");
    } else {
      setStatusWithTime("Audio DNA merged into fields — switch to Suno-like to use the guided path");
    }
  }, [
    audioAnalysis,
    promptEngine,
    setGuidedStep,
    setIdea,
    setMood,
    setNotes,
    setRules,
    setSelectedRhythms,
    setSelectedGenres,
    setSelectedSounds,
    setStatusWithTime,
    setTempo,
  ]);

  const applyImageToSunoStyle = useCallback(() => {
    if (!imageAnalysis) {
      setStatusWithTime("No image analysis yet");
      return;
    }
    setSelectedGenres((g) => mergeGuidedGenres(g, imageAnalysis.suggestedGenres));
    setSelectedSounds((s) => mergeGuidedSounds(s, imageAnalysis.suggestedSounds));
    setSelectedRhythms((r) => mergeGuidedRhythms(r, imageAnalysis.suggestedRhythms));
    if (imageAnalysis.moodSuggestion) {
      setMood((m) => applyMoodPatch(m, imageAnalysis.moodSuggestion));
    }
    setRules((prev) => mergeAnalyzerRuleLine(prev, "image", compactImageStyleRule(imageAnalysis)));
    setIdea((prev) => {
      const p = (prev || "").trim();
      const add = `Inspired by image: ${imageAnalysis.visualMood}`;
      if (!p) return add;
      if (p.toLowerCase().includes("inspired by image")) return p;
      if (p.length < 10) return `${p}. ${add}`;
      return p;
    });
    if (promptEngine === "Suno-like") {
      setGuidedStep(() => {
        const max = getStepCount() - 1;
        const polish = getGuidedPolishStepIndex();
        return Math.min(max, Math.max(0, polish));
      });
      setStatusWithTime("Image style merged — guided path: Polish (analyzers)");
    } else {
      setStatusWithTime("Image style merged into fields — switch to Suno-like to use the guided path");
    }
  }, [
    imageAnalysis,
    promptEngine,
    setGuidedStep,
    setIdea,
    setMood,
    setRules,
    setSelectedGenres,
    setSelectedRhythms,
    setSelectedSounds,
    setStatusWithTime,
  ]);

  const analyzeImageFile = useCallback(
    async (file) => {
      if (!isSupportedImageFile(file)) {
        setStatusWithTime(`Use ${SUPPORTED_IMAGE_LABEL} only for image analysis`);
        setNotes(`Image analyzer accepts ${SUPPORTED_IMAGE_LABEL} (check file extension or MIME type).`);
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

          let r = 0;
          let g = 0;
          let b = 0;
          let brightness = 0;
          let saturation = 0;
          let contrast = 0;
          const luminances = [];
          const pixels = data.length / 4;

          for (let i = 0; i < data.length; i += 4) {
            const rr = data[i];
            const gg = data[i + 1];
            const bb = data[i + 2];
            r += rr;
            g += gg;
            b += bb;
            const max = Math.max(rr, gg, bb);
            const min = Math.min(rr, gg, bb);
            const lum = 0.2126 * rr + 0.7152 * gg + 0.0722 * bb;
            brightness += lum;
            saturation += max === 0 ? 0 : ((max - min) / max) * 100;
            luminances.push(lum);
          }
          r = Math.round(r / pixels);
          g = Math.round(g / pixels);
          b = Math.round(b / pixels);
          brightness = brightness / pixels;
          saturation = saturation / pixels;
          const mean = brightness;
          for (const lum of luminances) contrast += Math.abs(lum - mean);
          contrast = contrast / luminances.length;

          const warm = r > b + 15;
          const cool = b > r + 15;
          const dark = brightness < 95;
          const bright = brightness > 165;
          const vivid = saturation > 45;
          const highContrast = contrast > 45;

          const newMood = {
            darkness: clamp(dark ? 82 : bright ? 25 : 55),
            energy: clamp(vivid ? 78 : bright ? 62 : 45),
            aggression: clamp(highContrast ? 72 : dark ? 55 : 35),
            emotion: clamp(warm ? 70 : cool ? 45 : 55),
            complexity: clamp(highContrast ? 78 : saturation > 30 ? 58 : 35),
            space: clamp(bright ? 75 : cool ? 68 : 50),
          };

          const imgGenres = [];
          const imgSounds = [];
          const imgRhythms = [];

          if (dark && highContrast) {
            imgGenres.push("Industrial", "Techno");
            imgSounds.push("Metallic percussion", "Distorted bass", "Noise atmosphere");
            imgRhythms.push("4/4", "Syncopated");
          }
          if (cool) {
            imgGenres.push("Ambient", "Cinematic");
            imgSounds.push("Dark pads", "Dub delays");
            imgRhythms.push("Minimal");
          }
          if (warm && vivid) {
            imgGenres.push("House", "Pop");
            imgSounds.push("Bright leads", "Big drums");
            imgRhythms.push("4/4");
          }
          if (bright && !vivid) {
            imgGenres.push("Ambient", "Orchestral");
            imgSounds.push("Piano", "Orchestral strings", "Soft drums");
            imgRhythms.push("Minimal");
          }
          if (vivid && highContrast) {
            imgGenres.push("Experimental");
            imgSounds.push("Glitch FX", "Analog synths");
            imgRhythms.push("Off-grid");
          }

          const visualMood = `${dark ? "dark" : bright ? "bright" : "balanced"}, ${vivid ? "vivid" : "muted"}, ${highContrast ? "high-contrast" : "soft-contrast"}, ${warm ? "warm" : cool ? "cool" : "neutral"}`;

          const summary = `File: ${file.name}
Average color: rgb(${r}, ${g}, ${b})
Visual mood: ${visualMood}
Brightness: ${Math.round(brightness)}/255
Saturation: ${Math.round(saturation)}/100
Contrast: ${Math.round(contrast)}/100
Suggested genres: ${uniq(imgGenres).join(", ") || "Experimental"}
Suggested sounds: ${uniq(imgSounds).join(", ") || "Analog synths, atmospheric textures"}
Suggested rhythms: ${uniq(imgRhythms).join(", ") || "Minimal"}
Interpretation: turn the image into a ${visualMood} music style with matching texture, space, and energy.`;

          setImageAnalysis({
            fileName: file.name,
            avgColor: `rgb(${r}, ${g}, ${b})`,
            brightness,
            saturation,
            contrast,
            visualMood,
            suggestedGenres: uniq(imgGenres),
            suggestedSounds: uniq(imgSounds),
            suggestedRhythms: uniq(imgRhythms),
            summary,
            moodSuggestion: newMood,
          });
          setStatusWithTime("Image ready — add to style below when you want it in Suno fields");
        };
        img.onerror = () => setStatusWithTime("Image analysis failed");
        img.src = url;
      } catch {
        setStatusWithTime("Image analysis failed");
      }
    },
    [setNotes, setStatusWithTime],
  );

  const exportEnhancedAudio = useCallback(
    async (presetId, opts = {}) => {
      if (!audioAnalysis) {
        setStatusWithTime("No track loaded to export");
        return;
      }
      if (audioExportBusy) return;

      const format = opts.format === "mp3" || opts.format === "flac" ? opts.format : "wav";
      const scope = opts.scope === "highlight" ? "highlight" : "full";

      setAudioExportBusy(true);
      setAudioExportProgress({ phase: "preparing", pct: 0 });
      setStatusWithTime("Studio export started…");

      let audioContext = null;
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

        const arrayBuffer = await blob.arrayBuffer();
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        let sourceBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));

        if (scope === "highlight") {
          const start = Number(audioAnalysis.highlightStart) || 0;
          const end =
            Number(audioAnalysis.highlightEnd) ||
            sourceBuffer.duration ||
            start + 1;
          sourceBuffer = sliceAudioBuffer(sourceBuffer, start, Math.max(start + 0.5, end));
        }

        const baseName = String(audioAnalysis.fileName || "track").replace(/\.[^.]+$/, "");
        const suffix =
          scope === "highlight" ? `-highlight-${presetId}` : `-enhanced-${presetId}`;

        const result = await exportEnhancedInWorker(sourceBuffer, presetId, `${baseName}${suffix}`, {
          format,
          onProgress: (p) => setAudioExportProgress(p),
        });

        const fmtLabel = format.toUpperCase();
        if (result?.afterLufs != null && Number.isFinite(result.afterLufs)) {
          setStatusWithTime(
            `${fmtLabel} downloaded · ${result.afterLufs.toFixed(1)} LUFS (target ${result.targetLufs})`,
          );
        } else {
          setStatusWithTime(
            scope === "highlight"
              ? `Highlight ${fmtLabel} downloaded`
              : `Enhanced ${fmtLabel} downloaded`,
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        setStatusWithTime(msg ? msg.slice(0, 80) : "Studio export failed");
      } finally {
        setAudioExportBusy(false);
        setAudioExportProgress(null);
        if (audioContext) {
          try {
            await audioContext.close();
          } catch {}
        }
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
    updateAudioAnalysis,
  };
}
