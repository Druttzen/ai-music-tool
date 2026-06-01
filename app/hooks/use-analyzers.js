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
import { getGuidedPolishStepIndex, getStepCount } from "../lib/suno-guided-workflow";
import { clamp, uniq } from "../lib/music-helpers";

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
  const [imageAnalysis, setImageAnalysis] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const canvasRef = useRef(null);
  const imagePreviewUrlRef = useRef(null);

  useEffect(() => {
    return () => {
      if (imagePreviewUrlRef.current) {
        URL.revokeObjectURL(imagePreviewUrlRef.current);
        imagePreviewUrlRef.current = null;
      }
    };
  }, []);

  const resetAnalyzers = useCallback(() => {
    setAudioAnalysis(null);
    setImageAnalysis(null);
    setImagePreview(null);
    if (imagePreviewUrlRef.current) {
      URL.revokeObjectURL(imagePreviewUrlRef.current);
      imagePreviewUrlRef.current = null;
    }
  }, []);

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
        const channel = buffer.getChannelData(0);
        const duration = buffer.duration;

        let sum = 0;
        let peak = 0;
        let zeroCrossings = 0;
        const step = Math.max(1, Math.floor(channel.length / 60000));
        let prev = channel[0];

        for (let i = 0; i < channel.length; i += step) {
          const v = channel[i];
          sum += v * v;
          peak = Math.max(peak, Math.abs(v));
          if ((prev < 0 && v >= 0) || (prev >= 0 && v < 0)) zeroCrossings++;
          prev = v;
        }

        const count = Math.ceil(channel.length / step);
        const rms = Math.sqrt(sum / count);
        const energy = clamp(Math.round(rms * 900));
        const aggression = clamp(Math.round(peak * 100));
        const brightness = clamp(Math.round((zeroCrossings / count) * 700));
        const darkness = clamp(100 - brightness + Math.round(energy * 0.2));
        const complexity = clamp(Math.round((zeroCrossings / count) * 1000 + energy * 0.4));
        const estimatedBpm =
          duration < 20
            ? "120 BPM"
            : `${Math.round(clamp(80 + energy * 0.7 + complexity * 0.25, 70, 180))} BPM`;

        const suggestedSounds = [];
        if (energy > 60) suggestedSounds.push("Heavy sub bass", "Big drums");
        if (aggression > 65) suggestedSounds.push("Distorted bass", "Metallic percussion");
        if (brightness > 55) suggestedSounds.push("Bright leads", "Glitch FX");
        if (darkness > 60) suggestedSounds.push("Dark pads", "Noise atmosphere");

        const suggestedRhythms =
          energy > 70 ? ["4/4", "Syncopated"] : complexity > 60 ? ["Breakbeat", "Off-grid"] : ["Minimal"];

        const summary = `File: ${file.name}
Duration: ${duration.toFixed(1)}s
Detected energy: ${energy}/100
Detected aggression: ${aggression}/100
Detected brightness: ${brightness}/100
Suggested tempo: ${estimatedBpm}
Suggested rhythm: ${suggestedRhythms.join(", ")}
Suggested sound: ${uniq(suggestedSounds).join(", ") || "balanced instruments and textures"}
Interpretation: ${energy > 70 ? "high-impact and club-ready" : energy < 35 ? "calm and atmospheric" : "controlled and balanced"} sound source.`;

        const moodSuggestion = { energy, aggression, darkness, complexity };
        setAudioAnalysis({
          fileName: file.name,
          duration,
          energy,
          aggression,
          brightness,
          estimatedBpm,
          suggestedSounds: uniq(suggestedSounds),
          suggestedRhythms,
          summary,
          moodSuggestion,
        });
        setStatusWithTime("Audio ready — add to style below when you want it in Suno fields");
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
    [setNotes, setStatusWithTime],
  );

  const applyAudioToSunoStyle = useCallback(() => {
    if (!audioAnalysis) {
      setStatusWithTime("No audio analysis yet");
      return;
    }
    setTempo(audioAnalysis.estimatedBpm);
    setSelectedSounds((s) => mergeGuidedSounds(s, audioAnalysis.suggestedSounds));
    setSelectedRhythms((r) => mergeGuidedRhythms(r, audioAnalysis.suggestedRhythms));
    if (audioAnalysis.moodSuggestion) {
      setMood((m) => applyMoodPatch(m, audioAnalysis.moodSuggestion));
    }
    setRules((prev) => mergeAnalyzerRuleLine(prev, "audio", compactAudioStyleRule(audioAnalysis)));
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
    setMood,
    setRules,
    setSelectedRhythms,
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

  return {
    analyzeAudioFile,
    analyzeImageFile,
    applyAudioToSunoStyle,
    applyImageToSunoStyle,
    audioAnalysis,
    canvasRef,
    imageAnalysis,
    imagePreview,
    resetAnalyzers,
    setAudioAnalysis,
    setImageAnalysis,
  };
}
