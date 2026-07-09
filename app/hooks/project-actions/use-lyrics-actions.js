"use client";

import { useCallback } from "react";
import {
  generateCoProducerHooks,
  generateCoProducerLyrics,
  mergeInstrumentalScaffoldWithStyleLyrics,
} from "../../lib/lyric-generator";
import {
  generateLyricsWithLlm,
  generateHooksWithLlm,
  isCoProducerLlmReady,
} from "../../lib/co-producer-llm";
import {
  buildInstrumentalLyricsScaffold,
  buildLyricThemeFromAnalysis,
  getGuidedLyricsStepIndex,
  inferStructureFromTrack,
  stripInstrumentalOnlyRules,
  suggestLyricStyleFromAnalysis,
  suggestVocalRoleFromAnalysis,
} from "../../lib/instrumental-lyrics-from-track";
import { buildMoodWords } from "../../lib/music-helpers";
import { useCoProducerVoiceFields } from "./_shared.js";

export function useLyricsActions(deps) {
  const coProducerVoiceFields = useCoProducerVoiceFields(deps);
  const {
    addHistory,
    applyAudioToSunoStyle,
    audioAnalysis,
    captureSnapshot,
    coProducerLlmSettings,
    currentState,
    idea,
    lyricDensity,
    lyricLanguage,
    lyricMode,
    lyricStructure,
    lyricStyle,
    lyricTheme,
    lyricVariantSeed,
    mood,
    moodWords,
    promptEngine,
    selectedGenres,
    setGeneratedHooks,
    setGeneratedHooksStyle,
    setGeneratedLyrics,
    setGeneratedLyricsStyle,
    setGuidedStep,
    setInstrumentalVocalFx,
    setLyricMode,
    setLyricStructure,
    setLyricStyle,
    setLyricTheme,
    setLyricVariantSeed,
    setLyricsGenerateBusy,
    setPromptEngine,
    setRules,
    setStatusWithTime,
    setStructure,
    setVocal,
    vocal,
  } = deps;

  const generateHooks = useCallback(
    async (bumpVariant = false) => {
      const nextSeed = bumpVariant ? lyricVariantSeed + 1 : lyricVariantSeed;
      if (bumpVariant) setLyricVariantSeed(nextSeed);
      const input = {
        vocal,
        lyricStyle,
        lyricTheme,
        lyricLanguage,
        mood,
        idea,
        moodWords,
        variantSeed: nextSeed,
        audioAnalysis,
        ...coProducerVoiceFields(),
      };
      if (vocal === "Instrumental") {
        setGeneratedHooks(generateCoProducerHooks(input).hooks);
        setStatusWithTime("Hooks skipped in instrumental mode");
        return;
      }

      let result;
      if (isCoProducerLlmReady(coProducerLlmSettings)) {
        try {
          result = await generateHooksWithLlm(input, coProducerLlmSettings);
        } catch {
          result = generateCoProducerHooks(input);
        }
      } else {
        result = generateCoProducerHooks(input);
      }

      setGeneratedHooks(result.hooks);
      setGeneratedHooksStyle(result.styleLabel);
      setStatusWithTime(
        result.source === "llm"
          ? `Co-Producer (LLM) generated ${result.styleLabel} hook ideas`
          : `Generated ${result.styleLabel} hook ideas`,
      );
    },
    [
      coProducerLlmSettings,
      coProducerVoiceFields,
      audioAnalysis,
      idea,
      lyricLanguage,
      lyricStyle,
      lyricTheme,
      lyricVariantSeed,
      mood,
      moodWords,
      setGeneratedHooks,
      setGeneratedHooksStyle,
      setLyricVariantSeed,
      setStatusWithTime,
      vocal,
    ],
  );

  const runGenerateLyrics = useCallback(
    async (bumpVariant = false) => {
      const nextSeed = bumpVariant ? lyricVariantSeed + 1 : lyricVariantSeed;
      if (bumpVariant) setLyricVariantSeed(nextSeed);

      const input = {
        vocal,
        lyricStyle,
        lyricTheme,
        lyricMode,
        lyricLanguage,
        lyricStructure,
        lyricDensity,
        mood,
        moodWords,
        selectedGenres,
        idea,
        variantSeed: nextSeed,
        ...coProducerVoiceFields(),
      };

      if (vocal === "Instrumental") {
        const result = generateCoProducerLyrics(input);
        setGeneratedLyrics(result.lyrics);
        setGeneratedLyricsStyle("");
        setStatusWithTime("Lyrics skipped in instrumental mode");
        return;
      }

      setLyricsGenerateBusy(true);
      try {
        let result;
        if (isCoProducerLlmReady(coProducerLlmSettings)) {
          try {
            result = await generateLyricsWithLlm(input, coProducerLlmSettings);
            setStatusWithTime(`LLM lyrics for ${result.styleLabel}`);
          } catch {
            result = generateCoProducerLyrics(input);
            setStatusWithTime(`LLM unavailable — built-in ${result.styleLabel} draft`);
          }
        } else {
          result = generateCoProducerLyrics(input);
          setStatusWithTime(
            bumpVariant
              ? `Another take · ${result.styleLabel} (${lyricMode})`
              : `Co-Producer generated ${lyricMode} lyrics for ${result.styleLabel}`,
          );
        }
        setGeneratedLyrics(result.lyrics);
        setGeneratedLyricsStyle(result.styleLabel);
        addHistory(`Lyrics · ${result.styleLabel}`, result.lyrics.slice(0, 500), currentState);
      } finally {
        setLyricsGenerateBusy(false);
      }
    },
    [
      addHistory,
      coProducerLlmSettings,
      coProducerVoiceFields,
      currentState,
      idea,
      lyricDensity,
      lyricLanguage,
      lyricMode,
      lyricStructure,
      lyricStyle,
      lyricTheme,
      lyricVariantSeed,
      mood,
      moodWords,
      selectedGenres,
      setGeneratedLyrics,
      setGeneratedLyricsStyle,
      setLyricVariantSeed,
      setLyricsGenerateBusy,
      setStatusWithTime,
      vocal,
    ],
  );

  const generateExampleLyrics = useCallback(() => runGenerateLyrics(false), [runGenerateLyrics]);
  const shuffleExampleLyrics = useCallback(() => runGenerateLyrics(true), [runGenerateLyrics]);

  const addLyricsFromInstrumentalTrack = useCallback(() => {
    if (!audioAnalysis) {
      setStatusWithTime("Upload an instrumental track first");
      return;
    }
    captureSnapshot("before add lyrics to track");
    applyAudioToSunoStyle();

    const theme = buildLyricThemeFromAnalysis(audioAnalysis);
    const trackStructure = inferStructureFromTrack(audioAnalysis);
    const suggestedStyle = suggestLyricStyleFromAnalysis(audioAnalysis);
    const vocalRole = suggestVocalRoleFromAnalysis(audioAnalysis);
    const scaffold = buildInstrumentalLyricsScaffold(audioAnalysis, { theme });
    const moodWordsLocal = buildMoodWords(mood);

    const coInput = {
      vocal: vocalRole,
      lyricStyle: suggestedStyle,
      lyricTheme: theme,
      lyricMode: "Structured Song",
      lyricLanguage,
      lyricStructure: trackStructure,
      lyricDensity,
      mood,
      moodWords: moodWordsLocal,
      selectedGenres,
      idea,
      variantSeed: 0,
      ...coProducerVoiceFields(),
    };
    const coProd = generateCoProducerLyrics(coInput);
    const hookResult = generateCoProducerHooks(coInput);
    const merged = mergeInstrumentalScaffoldWithStyleLyrics(scaffold, coProd);

    setInstrumentalVocalFx(false);
    setVocal(vocalRole);
    setLyricTheme(theme);
    setLyricStyle(suggestedStyle);
    setLyricMode("Structured Song");
    setLyricStructure(trackStructure);
    setStructure(trackStructure);
    setGeneratedLyrics(merged);
    setGeneratedLyricsStyle(suggestedStyle);
    setGeneratedHooks(hookResult.hooks);
    setGeneratedHooksStyle(suggestedStyle);
    setLyricVariantSeed(0);
    setRules((prev) => stripInstrumentalOnlyRules(prev));

    if (promptEngine !== "Suno-like") {
      setPromptEngine("Suno-like");
    }
    setGuidedStep(getGuidedLyricsStepIndex());
    setStatusWithTime(
      `Lyrics + ${suggestedStyle} singable draft added — timed to your track. Edit, then copy Lyrics.`,
    );
  }, [
    applyAudioToSunoStyle,
    audioAnalysis,
    captureSnapshot,
    coProducerVoiceFields,
    idea,
    lyricDensity,
    lyricLanguage,
    mood,
    promptEngine,
    selectedGenres,
    setGeneratedHooks,
    setGeneratedHooksStyle,
    setGeneratedLyrics,
    setGeneratedLyricsStyle,
    setGuidedStep,
    setInstrumentalVocalFx,
    setLyricMode,
    setLyricStructure,
    setLyricStyle,
    setLyricTheme,
    setLyricVariantSeed,
    setPromptEngine,
    setRules,
    setStatusWithTime,
    setStructure,
    setVocal,
  ]);

  return {
    generateHooks,
    generateExampleLyrics,
    shuffleExampleLyrics,
    addLyricsFromInstrumentalTrack,
  };
}
