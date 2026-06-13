"use client";

import { useMemo } from "react";
import { usePromptPipeline } from "./use-prompt-pipeline";

/**
 * Slim analyzer refs for the prompt pipeline (summary only, not waveform UI state).
 */
export function usePipelineInput({
  mood,
  promptIntensity,
  vocal,
  instrumentalVocalFx,
  lyricDensity,
  lyricLanguage,
  lyricTheme,
  lyricStyle,
  lyricMode,
  lyricStructure,
  selectedGenres,
  tempo,
  selectedSounds,
  selectedRhythms,
  idea,
  structure,
  rules,
  mode,
  promptFormat,
  promptEngine,
  coProducerOutput,
  notes,
  audioAnalysis,
  imageAnalysis,
  voiceStyleLine,
  voiceRefFirstName,
  voiceRefLastName,
  generatedLyrics,
}) {
  const audioSummaryForPipeline = audioAnalysis?.summary ?? "";
  const imageSummaryForPipeline = imageAnalysis?.summary ?? "";
  const hasAudioAnalysis = Boolean(audioAnalysis);
  const hasImageAnalysis = Boolean(imageAnalysis);

  const pipelineAudioAnalysis = useMemo(
    () => (hasAudioAnalysis ? { summary: String(audioSummaryForPipeline) } : null),
    [hasAudioAnalysis, audioSummaryForPipeline],
  );

  const pipelineImageAnalysis = useMemo(
    () => (hasImageAnalysis ? { summary: String(imageSummaryForPipeline) } : null),
    [hasImageAnalysis, imageSummaryForPipeline],
  );

  const pipelineInput = useMemo(
    () => ({
      mood,
      promptIntensity,
      vocal,
      instrumentalVocalFx,
      lyricDensity,
      lyricLanguage,
      lyricTheme,
      lyricStyle,
      lyricMode,
      lyricStructure,
      selectedGenres,
      tempo,
      selectedSounds,
      selectedRhythms,
      idea,
      structure,
      rules,
      mode,
      promptFormat,
      promptEngine,
      coProducerOutput,
      notes,
      audioAnalysis: pipelineAudioAnalysis,
      imageAnalysis: pipelineImageAnalysis,
      voiceStyleLine,
      voiceRefFirstName,
      voiceRefLastName,
      generatedLyrics,
    }),
    [
      mood,
      promptIntensity,
      vocal,
      instrumentalVocalFx,
      lyricDensity,
      lyricLanguage,
      lyricTheme,
      lyricStyle,
      lyricMode,
      lyricStructure,
      selectedGenres,
      tempo,
      selectedSounds,
      selectedRhythms,
      idea,
      structure,
      rules,
      mode,
      promptFormat,
      promptEngine,
      coProducerOutput,
      notes,
      pipelineAudioAnalysis,
      pipelineImageAnalysis,
      voiceStyleLine,
      voiceRefFirstName,
      voiceRefLastName,
      generatedLyrics,
    ],
  );

  return usePromptPipeline(pipelineInput);
}
