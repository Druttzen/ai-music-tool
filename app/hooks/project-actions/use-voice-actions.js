"use client";

import { useCallback } from "react";
import { resolveAudioCacheBlob } from "../../lib/audio-cache";
import { buildStyleDnaPatch } from "../../lib/track-style-dna";
import { resolvePolishStepIndex } from "../../lib/suno-guided-workflow";
import { buildSunoVoiceStyleLine, formatPublicName } from "../../lib/suno-voice-style";
import {
  dispatchVoiceCharacterAnalyzeFile,
  scrollToVoiceCharacterStudioPanel,
} from "../../lib/voice-character-handoff";

export function useVoiceActions(deps) {
  const {
    audioAnalysis,
    audioPreviewUrl,
    captureSnapshot,
    moodWords,
    patch,
    promptEngine,
    selectedGenres,
    setGuidedStep,
    setPromptEngine,
    setStatusWithTime,
    setVoiceStyleLine,
    voiceRefFirstName,
    voiceRefLastName,
  } = deps;

  const generateVoiceStyleFromNames = useCallback(() => {
    if (!formatPublicName(voiceRefFirstName, voiceRefLastName).trim()) {
      setStatusWithTime("Enter at least a first name (last name optional for mononyms)");
      return;
    }
    const line = buildSunoVoiceStyleLine({
      firstName: voiceRefFirstName,
      lastName: voiceRefLastName,
      selectedGenres,
      moodWords,
    });
    setVoiceStyleLine(line);
    setStatusWithTime("Voice style line generated");
  }, [
    moodWords,
    selectedGenres,
    setStatusWithTime,
    setVoiceStyleLine,
    voiceRefFirstName,
    voiceRefLastName,
  ]);

  const applyStyleDnaToProject = useCallback(
    (dna) => {
      if (!dna) return;
      captureSnapshot("before style DNA merge");
      patch(buildStyleDnaPatch(dna));
      if (promptEngine !== "Suno-like") {
        setPromptEngine("Suno-like");
      }
      setGuidedStep(resolvePolishStepIndex());
      setStatusWithTime(`Applied Style DNA: ${dna.artist} — ${dna.title}`);
    },
    [captureSnapshot, patch, promptEngine, setGuidedStep, setPromptEngine, setStatusWithTime],
  );

  const handoffTrackToVoiceCharacterStudio = useCallback(async () => {
    if (!audioAnalysis) {
      setStatusWithTime("Analyze a track first", "warning");
      return;
    }
    captureSnapshot("before vocal character handoff");
    let blob = (await resolveAudioCacheBlob(audioAnalysis))?.blob;
    if (!blob && audioPreviewUrl) {
      try {
        blob = await fetch(audioPreviewUrl).then((r) => r.blob());
      } catch {
        blob = null;
      }
    }
    if (!blob) {
      setStatusWithTime("Re-attach the audio file for vocal character analysis", "warning");
      return;
    }
    const file = new File([blob], audioAnalysis.fileName || "track.wav", {
      type: blob.type || "audio/wav",
    });
    dispatchVoiceCharacterAnalyzeFile(file);
    scrollToVoiceCharacterStudioPanel();
    const vocalsTag = String(audioAnalysis.vocals || "").toLowerCase();
    if (vocalsTag.includes("instrumental")) {
      setStatusWithTime(
        "Handoff sent — acapella or isolated lead works best for trait analysis",
        "warning",
      );
    } else {
      setStatusWithTime("Analyzing vocal character in Voice Character Studio…", "info");
    }
    if (promptEngine === "Suno-like") {
      setGuidedStep(resolvePolishStepIndex());
    }
  }, [
    audioAnalysis,
    audioPreviewUrl,
    captureSnapshot,
    promptEngine,
    setGuidedStep,
    setStatusWithTime,
  ]);

  return {
    generateVoiceStyleFromNames,
    applyStyleDnaToProject,
    handoffTrackToVoiceCharacterStudio,
  };
}
