import {
  buildLyricPrompt,
  buildMoodWords,
  buildVocalTextForPrompt,
  getIntensityText,
} from "../lib/music-helpers";
import {
  buildSunoLikePrompt,
  buildStandardPrompt,
  validateSunoLikePrompt,
} from "../lib/suno-rules";
import {
  buildSunoPastedLyricsField,
  buildSunoPastedStyleLine,
  isGuidedPasteBlank,
} from "../lib/suno-guided-workflow";
import { applySunoPasteToSlices } from "../lib/suno-reimport";
import { buildUsableAnalyzerStylePrompt } from "../lib/analyzer-guided-merge";
import { buildSunoVoiceStyleCompact } from "../lib/suno-voice-style";
import { useMemo } from "react";

/**
 * @typedef {object} PromptPipelineInput
 * @property {object} mood
 * @property {number} promptIntensity
 * @property {string} vocal
 * @property {boolean} instrumentalVocalFx
 * @property {number} lyricDensity
 * @property {string} lyricLanguage
 * @property {string} lyricTheme
 * @property {string} lyricStyle
 * @property {string} lyricMode
 * @property {string} lyricStructure
 * @property {string[]} selectedGenres
 * @property {string} tempo
 * @property {string[]} selectedSounds
 * @property {string[]} selectedRhythms
 * @property {string} idea
 * @property {string} structure
 * @property {string} rules
 * @property {string} mode
 * @property {string} promptFormat
 * @property {string} promptEngine
 * @property {string} coProducerOutput
 * @property {string} notes
 * @property {object|null} audioAnalysis
 * @property {object|null} imageAnalysis
 * @property {string} voiceStyleLine
 * @property {string} voiceRefFirstName
 * @property {string} voiceRefLastName
 * @property {string} generatedLyrics
 * @property {string} sunoPasteStyle
 * @property {string} sunoPasteLyrics
 * @property {boolean} sunoPasteActive
 */

function buildSourcePrompt(audioAnalysis, imageAnalysis) {
  return buildUsableAnalyzerStylePrompt(audioAnalysis, imageAnalysis);
}

/**
 * Derives preview prompt strings, Suno field slices, validator warnings, and guided-path input.
 * @param {PromptPipelineInput} input
 */
export function usePromptPipeline(input) {
  const moodWords = useMemo(() => buildMoodWords(input.mood), [input.mood]);

  const intensityText = useMemo(
    () => getIntensityText(input.promptIntensity),
    [input.promptIntensity],
  );

  const vocalText = useMemo(
    () => buildVocalTextForPrompt(input.vocal, input.instrumentalVocalFx),
    [input.vocal, input.instrumentalVocalFx],
  );

  const lyricPrompt = useMemo(
    () =>
      buildLyricPrompt({
        vocal: input.vocal,
        lyricDensity: input.lyricDensity,
        lyricLanguage: input.lyricLanguage,
        lyricTheme: input.lyricTheme,
        lyricStyle: input.lyricStyle,
        lyricMode: input.lyricMode,
        lyricStructure: input.lyricStructure,
        selectedGenres: input.selectedGenres,
        moodWords,
      }),
    [
      input.vocal,
      input.lyricDensity,
      input.lyricLanguage,
      input.lyricTheme,
      input.lyricStyle,
      input.lyricMode,
      input.lyricStructure,
      input.selectedGenres,
      moodWords,
    ],
  );

  const standardParams = useMemo(
    () => ({
      selectedGenres: input.selectedGenres,
      tempo: input.tempo,
      moodWords,
      selectedSounds: input.selectedSounds,
      selectedRhythms: input.selectedRhythms,
      vocalText,
      structure: input.structure,
      idea: input.idea,
      vocal: input.vocal,
      lyricPrompt,
      lyricStyle: input.lyricStyle,
      lyricTheme: input.lyricTheme,
      rules: input.rules,
      intensityText,
      mode: input.mode,
      audioAnalysis: input.audioAnalysis,
      imageAnalysis: input.imageAnalysis,
      coProducerOutput: input.coProducerOutput,
      notes: input.notes,
    }),
    [
      input.selectedGenres,
      input.tempo,
      moodWords,
      input.selectedSounds,
      input.selectedRhythms,
      vocalText,
      input.structure,
      input.idea,
      input.vocal,
      lyricPrompt,
      input.lyricStyle,
      input.lyricTheme,
      input.rules,
      intensityText,
      input.mode,
      input.audioAnalysis,
      input.imageAnalysis,
      input.coProducerOutput,
      input.notes,
    ],
  );

  const blankPasteInput = useMemo(
    () => ({
      selectedGenres: input.selectedGenres,
      selectedSounds: input.selectedSounds,
      selectedRhythms: input.selectedRhythms,
      vocal: input.vocal,
      idea: input.idea,
      rules: input.rules,
      tempo: input.tempo,
      moodWords,
      voiceStyleLine: input.voiceStyleLine,
      generatedLyrics: input.generatedLyrics,
      lyricTheme: input.lyricTheme,
      lyricStructure: input.lyricStructure,
    }),
    [
      input.selectedGenres,
      input.selectedSounds,
      input.selectedRhythms,
      input.vocal,
      input.idea,
      input.rules,
      input.tempo,
      moodWords,
      input.voiceStyleLine,
      input.generatedLyrics,
      input.lyricTheme,
      input.lyricStructure,
    ],
  );

  const prompt = useMemo(() => {
    if (isGuidedPasteBlank(blankPasteInput)) return "";

    if (input.promptEngine === "Suno-like") {
      return buildSunoLikePrompt({
        ...standardParams,
        voiceStyleReference: input.voiceStyleLine,
      });
    }

    const format =
      input.promptFormat === "Compressed"
        ? "Compressed"
        : input.promptFormat === "Detailed"
          ? "Detailed"
          : "Balanced";

    return buildStandardPrompt({ ...standardParams, format });
  }, [
    blankPasteInput,
    input.promptEngine,
    input.promptFormat,
    input.voiceStyleLine,
    standardParams,
  ]);

  const sunoBuiltFieldSlices = useMemo(() => {
    const guided = {
      selectedGenres: input.selectedGenres,
      tempo: input.tempo,
      moodWords,
      selectedSounds: input.selectedSounds,
      selectedRhythms: input.selectedRhythms,
      vocalText,
      structure: input.structure,
      idea: input.idea,
      vocal: input.vocal,
      rules: input.rules,
      intensityText,
      mode: input.mode,
      voiceStyleReference: input.voiceStyleLine,
      voiceStyleLine: input.voiceStyleLine,
      lyricTheme: input.lyricTheme,
      lyricLanguage: input.lyricLanguage,
      lyricStructure: input.lyricStructure,
      lyricStyle: input.lyricStyle,
      lyricDensity: input.lyricDensity,
      lyricMode: input.lyricMode,
      generatedLyrics: input.generatedLyrics,
      lyricPrompt,
      instrumentalVocalFx: input.instrumentalVocalFx,
    };
    return {
      style: buildSunoPastedStyleLine(guided),
      lyrics: buildSunoPastedLyricsField(guided),
    };
  }, [
    input.selectedGenres,
    input.tempo,
    moodWords,
    input.selectedSounds,
    input.selectedRhythms,
    vocalText,
    input.structure,
    input.idea,
    input.vocal,
    input.rules,
    intensityText,
    input.mode,
    input.voiceStyleLine,
    lyricPrompt,
    input.lyricTheme,
    input.lyricLanguage,
    input.lyricStructure,
    input.lyricStyle,
    input.lyricDensity,
    input.lyricMode,
    input.generatedLyrics,
    input.instrumentalVocalFx,
  ]);

  const sunoFieldSlices = useMemo(
    () =>
      applySunoPasteToSlices(sunoBuiltFieldSlices, {
        sunoPasteActive: input.sunoPasteActive,
        sunoPasteStyle: input.sunoPasteStyle,
        sunoPasteLyrics: input.sunoPasteLyrics,
      }),
    [
      sunoBuiltFieldSlices,
      input.sunoPasteActive,
      input.sunoPasteStyle,
      input.sunoPasteLyrics,
    ],
  );

  const sunoSlices = sunoFieldSlices;

  const sunoWarnings = useMemo(
    () =>
      validateSunoLikePrompt({
        selectedGenres: input.selectedGenres,
        selectedSounds: input.selectedSounds,
        selectedRhythms: input.selectedRhythms,
        vocal: input.vocal,
        instrumentalVocalFx: input.instrumentalVocalFx,
        rules: input.rules,
        structure: input.structure,
        idea: input.idea,
        tempo: input.tempo,
        moodWords,
        vocalText,
        lyricPrompt,
        intensityText,
        mode: input.mode,
        voiceStyleReference: input.voiceStyleLine,
        ...(input.promptEngine === "Suno-like"
          ? {
              pastedStyleLen: sunoFieldSlices.style.length,
              pastedLyricsLen: sunoFieldSlices.lyrics.length,
            }
          : {}),
      }),
    [
      input.selectedGenres,
      input.selectedSounds,
      input.selectedRhythms,
      input.vocal,
      input.instrumentalVocalFx,
      input.rules,
      input.structure,
      input.idea,
      input.tempo,
      moodWords,
      vocalText,
      lyricPrompt,
      intensityText,
      input.mode,
      input.voiceStyleLine,
      input.promptEngine,
      sunoFieldSlices,
    ],
  );

  const sunoGuidedInput = useMemo(
    () => ({
      selectedGenres: input.selectedGenres,
      tempo: input.tempo,
      moodWords,
      selectedSounds: input.selectedSounds,
      selectedRhythms: input.selectedRhythms,
      vocal: input.vocal,
      instrumentalVocalFx: input.instrumentalVocalFx,
      idea: input.idea,
      structure: input.structure,
      rules: input.rules,
      mode: input.mode,
      voiceStyleLine: input.voiceStyleLine,
      lyricPrompt,
      lyricTheme: input.lyricTheme,
      lyricLanguage: input.lyricLanguage,
      lyricStructure: input.lyricStructure,
      lyricStyle: input.lyricStyle,
      lyricDensity: input.lyricDensity,
      lyricMode: input.lyricMode,
      generatedLyrics: input.generatedLyrics,
    }),
    [
      input.selectedGenres,
      input.tempo,
      moodWords,
      input.selectedSounds,
      input.selectedRhythms,
      input.vocal,
      input.instrumentalVocalFx,
      input.idea,
      input.structure,
      input.rules,
      input.mode,
      input.voiceStyleLine,
      lyricPrompt,
      input.lyricTheme,
      input.lyricLanguage,
      input.lyricStructure,
      input.lyricStyle,
      input.lyricDensity,
      input.lyricMode,
      input.generatedLyrics,
    ],
  );

  const voiceStyleCompact = useMemo(
    () =>
      buildSunoVoiceStyleCompact({
        firstName: input.voiceRefFirstName,
        lastName: input.voiceRefLastName,
        selectedGenres: input.selectedGenres,
      }),
    [input.voiceRefFirstName, input.voiceRefLastName, input.selectedGenres],
  );

  const sourcePrompt = useMemo(
    () => buildSourcePrompt(input.audioAnalysis, input.imageAnalysis),
    [input.audioAnalysis, input.imageAnalysis],
  );

  return {
    moodWords,
    intensityText,
    vocalText,
    lyricPrompt,
    prompt,
    sunoBuiltFieldSlices,
    sunoFieldSlices,
    sunoSlices,
    sunoWarnings,
    sunoGuidedInput,
    voiceStyleCompact,
    sourcePrompt,
  };
}
