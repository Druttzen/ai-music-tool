import { useMemo } from "react";
import { usePromptPipeline } from "./use-prompt-pipeline";
import type { ProjectState } from "../lib/project-schema";

type AnalyzerSummaryRef = { summary: string } | null;

export interface PipelineInputFields {
  mood: ProjectState["mood"];
  promptIntensity: ProjectState["promptIntensity"];
  vocal: ProjectState["vocal"];
  instrumentalVocalFx: ProjectState["instrumentalVocalFx"];
  lyricDensity: ProjectState["lyricDensity"];
  lyricLanguage: ProjectState["lyricLanguage"];
  lyricTheme: ProjectState["lyricTheme"];
  lyricStyle: ProjectState["lyricStyle"];
  lyricMode: ProjectState["lyricMode"];
  lyricStructure: ProjectState["lyricStructure"];
  selectedGenres: ProjectState["selectedGenres"];
  tempo: ProjectState["tempo"];
  selectedSounds: ProjectState["selectedSounds"];
  selectedRhythms: ProjectState["selectedRhythms"];
  idea: ProjectState["idea"];
  structure: ProjectState["structure"];
  rules: ProjectState["rules"];
  mode: ProjectState["mode"];
  promptFormat: ProjectState["promptFormat"];
  promptEngine: ProjectState["promptEngine"];
  coProducerOutput: ProjectState["coProducerOutput"];
  notes: ProjectState["notes"];
  audioAnalysis: { summary?: string } | null | undefined;
  imageAnalysis: { summary?: string } | null | undefined;
  voiceStyleLine: ProjectState["voiceStyleLine"];
  voiceRefFirstName: ProjectState["voiceRefFirstName"];
  voiceRefLastName: ProjectState["voiceRefLastName"];
  generatedLyrics: ProjectState["generatedLyrics"];
  scores: ProjectState["scores"];
  albumRoles: ProjectState["albumRoles"];
  sunoPasteStyle: ProjectState["sunoPasteStyle"];
  sunoPasteLyrics: ProjectState["sunoPasteLyrics"];
  sunoPasteActive: ProjectState["sunoPasteActive"];
}

/**
 * Slim analyzer refs for the prompt pipeline (summary only, not waveform UI state).
 */
export function usePipelineInput(fields: PipelineInputFields) {
  const {
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
    scores,
    albumRoles,
    sunoPasteStyle,
    sunoPasteLyrics,
    sunoPasteActive,
  } = fields;

  const audioSummaryForPipeline = audioAnalysis?.summary ?? "";
  const imageSummaryForPipeline = imageAnalysis?.summary ?? "";
  const hasAudioAnalysis = Boolean(audioAnalysis);
  const hasImageAnalysis = Boolean(imageAnalysis);

  const pipelineAudioAnalysis: AnalyzerSummaryRef = useMemo(
    () => (hasAudioAnalysis ? { summary: String(audioSummaryForPipeline) } : null),
    [hasAudioAnalysis, audioSummaryForPipeline],
  );

  const pipelineImageAnalysis: AnalyzerSummaryRef = useMemo(
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
      scores,
      albumRoles,
      sunoPasteStyle,
      sunoPasteLyrics,
      sunoPasteActive,
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
      scores,
      albumRoles,
      sunoPasteStyle,
      sunoPasteLyrics,
      sunoPasteActive,
    ],
  );

  return usePromptPipeline(pipelineInput);
}
