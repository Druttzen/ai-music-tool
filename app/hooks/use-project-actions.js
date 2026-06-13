"use client";

import { useCallback } from "react";
import {
  buildCoProducerAdvisoryReport,
  buildCoProducerQuickTweakPatch,
} from "../lib/co-producer-engine";
import {
  generateCoProducerHooks,
  generateCoProducerLyrics,
  mergeInstrumentalScaffoldWithStyleLyrics,
} from "../lib/lyric-generator";
import {
  generateLyricsWithLlm,
  isCoProducerLlmReady,
} from "../lib/co-producer-llm";
import {
  buildInstrumentalLyricsScaffold,
  buildLyricThemeFromAnalysis,
  getGuidedLyricsStepIndex,
  inferStructureFromTrack,
  stripInstrumentalOnlyRules,
  suggestLyricStyleFromAnalysis,
  suggestVocalRoleFromAnalysis,
} from "../lib/instrumental-lyrics-from-track";
import {
  APP_VERSION,
  DEFAULT_STATE,
  fixes,
  HISTORY_KEY,
  PRESET_KEY,
  STORAGE_KEY,
  stylePresets,
} from "../lib/music-config";
import { buildMoodWords, toggleListItem, uniq } from "../lib/music-helpers";
import {
  migrateImportedProject,
  slimStateForHistory,
  slimStateForPersistence,
} from "../lib/project-persistence";
import {
  extractCharacterVoicePresetsFromProject,
  persistCharacterVoicePresets,
} from "../lib/voice-character-preset";
import {
  attachCharacterVoiceFieldsToProjectExport,
  clearCharacterVoiceStudioSessionOnReset,
  extractCharacterVoiceStudioSessionFromProject,
  persistCharacterVoiceStudioSession,
  pickVoiceStyleCompactForCoProducer,
} from "../lib/voice-character-studio-session";
import {
  dispatchVoiceCharacterAnalyzeFile,
  scrollToVoiceCharacterStudioPanel,
} from "../lib/voice-character-handoff";
import { resolveAudioCacheBlob } from "../lib/audio-cache";
import { collectGenreAnchors } from "../lib/suno-language-index";
import { resolvePolishStepIndex } from "../lib/suno-guided-workflow";
import { SUNO_AUTO_FIX_DEFAULTS } from "../lib/suno-rules";
import { safeLocalStorage, storageFailureMessage } from "../lib/safe-local-storage";
import { buildSunoVoiceStyleLine, formatPublicName } from "../lib/suno-voice-style";

/**
 * Project handlers: presets, history, co-producer, lyrics, variations, import/export.
 */
export function useProjectActions({
  audioAnalysis,
  audioPreviewUrl,
  avgScore,
  captureSnapshot,
  coProducerLlmSettings,
  copyToClipboard,
  currentState,
  customPresets,
  history,
  idea,
  instrumentalVocalFx,
  intensityText,
  lastAutosavePayloadRef,
  loadState,
  lyricDensity,
  lyricLanguage,
  lyricMode,
  lyricPrompt,
  lyricStructure,
  lyricStyle,
  lyricTheme,
  lyricVariantSeed,
  mode,
  mood,
  moodWords,
  patch,
  presetName,
  prompt,
  promptEngine,
  sunoSlices,
  promptIntensity,
  resetAnalyzers,
  resetBlank,
  resetSplash,
  rules,
  scores,
  selectedGenres,
  selectedHistoryId,
  selectedRhythms,
  selectedSounds,
  setCopied,
  setCoProducerOutput,
  setCustomPresets,
  setGeneratedHooks,
  setGeneratedHooksStyle,
  setGeneratedLyrics,
  setGeneratedLyricsStyle,
  setGuidedStep,
  setHistory,
  setIdea,
  setInstrumentalVocalFx,
  setLyricMode,
  setLyricStructure,
  setLyricStyle,
  setLyricTheme,
  setLyricVariantSeed,
  setLyricsGenerateBusy,
  setMode,
  setMood,
  setNotes,
  setPresetName,
  setPromptEngine,
  setPromptIntensity,
  setRules,
  setSelectedGenres,
  setSelectedHistoryId,
  setSelectedRhythms,
  setSelectedSounds,
  setStatusWithTime,
  setStructure,
  setTempo,
  setVariationCount,
  setVariations,
  setVocal,
  setVoiceRefFirstName,
  setVoiceRefLastName,
  setVoiceStyleLine,
  structure,
  tempo,
  variationCount,
  vocal,
  vocalText,
  voiceRefFirstName,
  voiceRefLastName,
  voiceStyleLine,
  voiceStyleCompact,
  applyAudioToSunoStyle,
  imageAnalysis,
}) {
  const coProducerVoiceFields = useCallback(
    () => ({
      voiceStyleLine,
      voiceStyleCompact: pickVoiceStyleCompactForCoProducer(voiceStyleCompact),
    }),
    [voiceStyleLine, voiceStyleCompact],
  );
  const toggle = useCallback(
    (item, list, setter) => setter(toggleListItem(item, list)),
    [],
  );

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

  const fixSunoWarnings = useCallback(() => {
    const d = SUNO_AUTO_FIX_DEFAULTS;
    if (!selectedGenres.length) setSelectedGenres(d.genres);
    if (!selectedSounds.length) setSelectedSounds(d.sounds);
    if (!selectedRhythms.length) setSelectedRhythms(d.rhythms);
    if (!structure || structure.trim().length < 8) setStructure(d.structure);
    if (!idea || idea.trim().length < 10) setIdea(d.idea);
    if (
      vocal === "Instrumental" &&
      !instrumentalVocalFx &&
      !rules.toLowerCase().includes("no vocal")
    ) {
      setRules((prev) => `${prev}${prev.trim() ? "\n" : ""}${d.instrumentalRule}`);
    }
    if (selectedGenres.length > d.maxGenres) {
      setSelectedGenres(selectedGenres.slice(0, d.maxGenres));
    }
    setStatusWithTime("Applied Suno-like auto-fixes");
  }, [
    idea,
    instrumentalVocalFx,
    rules,
    selectedGenres,
    selectedRhythms,
    selectedSounds,
    setIdea,
    setRules,
    setSelectedGenres,
    setSelectedRhythms,
    setSelectedSounds,
    setStatusWithTime,
    setStructure,
    structure,
    vocal,
  ]);

  const applyGenreAnchors = useCallback(() => {
    const { sounds: anchorSounds, rhythms: anchorRhythms, rules: ruleAdditions } =
      collectGenreAnchors(selectedGenres);

    if (!anchorSounds.length && !anchorRhythms.length && !ruleAdditions.length) {
      setStatusWithTime("No known genre anchors to apply");
      return;
    }

    if (anchorSounds.length) setSelectedSounds((prev) => uniq([...prev, ...anchorSounds]));
    if (anchorRhythms.length) setSelectedRhythms((prev) => uniq([...prev, ...anchorRhythms]));
    if (ruleAdditions.length) {
      setRules((prev) => {
        const merged = uniq([
          ...prev.split("\n").map((x) => x.trim()).filter(Boolean),
          ...ruleAdditions,
        ]);
        return merged.join("\n");
      });
    }
    setStatusWithTime("Applied genre anchors");
  }, [selectedGenres, setRules, setSelectedRhythms, setSelectedSounds, setStatusWithTime]);

  const saveProject = useCallback(() => {
    const slim = attachCharacterVoiceFieldsToProjectExport(slimStateForPersistence(currentState));
    const payload = JSON.stringify(slim, null, 2);
    const result = safeLocalStorage.set(STORAGE_KEY, payload);
    if (!result.ok) {
      setStatusWithTime(storageFailureMessage(result), "error");
      return;
    }
    lastAutosavePayloadRef.current = payload;
    setStatusWithTime("Saved");
  }, [currentState, lastAutosavePayloadRef, setStatusWithTime]);

  const exportProject = useCallback(() => {
    const payload = attachCharacterVoiceFieldsToProjectExport(currentState);
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ai-music-project.json";
    a.click();
    URL.revokeObjectURL(url);
    setStatusWithTime("Exported JSON project");
  }, [currentState, setStatusWithTime]);

  const importProject = useCallback(
    (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          captureSnapshot("before import");
          const raw = JSON.parse(String(reader.result));
          const cvPresets = extractCharacterVoicePresetsFromProject(raw);
          if (cvPresets && Object.keys(cvPresets).length > 0) {
            const presetResult = persistCharacterVoicePresets(cvPresets, { merge: true });
            if (!presetResult.ok) {
              setStatusWithTime(storageFailureMessage(presetResult), "error");
            }
          }
          const cvSession = extractCharacterVoiceStudioSessionFromProject(raw);
          if (cvSession !== null) {
            persistCharacterVoiceStudioSession(cvSession);
          }
          loadState(migrateImportedProject(raw, APP_VERSION));
          setStatusWithTime("Imported JSON project");
        } catch {
          setStatusWithTime("Import failed", "error");
        }
      };
      reader.readAsText(file);
    },
    [captureSnapshot, loadState, setStatusWithTime],
  );

  const saveCustomPreset = useCallback(() => {
    const name = presetName.trim();
    if (!name) {
      setStatusWithTime("Preset name missing");
      return;
    }
    const next = {
      ...customPresets,
      [name]: {
        genres: selectedGenres,
        rhythms: selectedRhythms,
        sounds: selectedSounds,
        vocal,
        instrumentalVocalFx,
        tempo,
        structure,
        mood,
        rules,
        mode,
        promptIntensity,
      },
    };
    setCustomPresets(next);
    const result = safeLocalStorage.setJSON(PRESET_KEY, next);
    if (!result.ok) {
      setStatusWithTime(storageFailureMessage(result), "error");
      return;
    }
    setPresetName("");
    setStatusWithTime(`Saved preset: ${name}`);
  }, [
    customPresets,
    instrumentalVocalFx,
    mode,
    mood,
    presetName,
    promptIntensity,
    rules,
    selectedGenres,
    selectedRhythms,
    selectedSounds,
    setCustomPresets,
    setPresetName,
    setStatusWithTime,
    structure,
    tempo,
    vocal,
  ]);

  const loadPresetObject = useCallback(
    (name, p) => {
      setSelectedGenres(p.genres ?? DEFAULT_STATE.selectedGenres);
      setSelectedRhythms(p.rhythms ?? DEFAULT_STATE.selectedRhythms);
      setSelectedSounds(p.sounds ?? DEFAULT_STATE.selectedSounds);
      setVocal(p.vocal ?? DEFAULT_STATE.vocal);
      setInstrumentalVocalFx(p.instrumentalVocalFx ?? false);
      setTempo(p.tempo ?? DEFAULT_STATE.tempo);
      setStructure(p.structure ?? DEFAULT_STATE.structure);
      if (p.mood) setMood(p.mood);
      if (p.rules) setRules(p.rules);
      if (p.mode) setMode(p.mode);
      if (typeof p.promptIntensity === "number") setPromptIntensity(p.promptIntensity);
      setStatusWithTime(`Loaded preset: ${name}`);
    },
    [
      setInstrumentalVocalFx,
      setMode,
      setMood,
      setPromptIntensity,
      setRules,
      setSelectedGenres,
      setSelectedRhythms,
      setSelectedSounds,
      setStatusWithTime,
      setStructure,
      setTempo,
      setVocal,
    ],
  );

  const deleteCustomPreset = useCallback(
    (name) => {
      const next = { ...customPresets };
      delete next[name];
      setCustomPresets(next);
      const result = safeLocalStorage.setJSON(PRESET_KEY, next);
      if (!result.ok) {
        setStatusWithTime(storageFailureMessage(result), "error");
        return;
      }
      setStatusWithTime(`Deleted preset: ${name}`);
    },
    [customPresets, setCustomPresets, setStatusWithTime],
  );

  const applyPreset = useCallback(
    (name) => {
      captureSnapshot(`before preset ${name}`);
      loadPresetObject(name, stylePresets[name]);
    },
    [captureSnapshot, loadPresetObject],
  );

  const addHistory = useCallback(
    (label, promptText = prompt, state = currentState) => {
      const item = {
        id: Date.now(),
        label,
        time: new Date().toLocaleTimeString(),
        prompt: promptText,
        state: slimStateForHistory(state),
        avgScore,
      };
      const next = [item, ...history].slice(0, 12);
      setHistory(next);
      const result = safeLocalStorage.setJSON(HISTORY_KEY, next);
      if (!result.ok) setStatusWithTime(storageFailureMessage(result), "error");
    },
    [avgScore, currentState, history, prompt, setHistory, setStatusWithTime],
  );

  const copyPrompt = useCallback(async () => {
    const text = sunoSlices
      ? [sunoSlices.style, sunoSlices.lyrics].filter(Boolean).join("\n\n")
      : prompt;
    const ok = await copyToClipboard(text, "Prompt copied");
    if (!ok) return;
    setCopied(true);
    addHistory("Copied prompt");
    setTimeout(() => setCopied(false), 1200);
  }, [addHistory, copyToClipboard, prompt, setCopied, sunoSlices]);

  const restoreHistory = useCallback(
    (item) => {
      loadState(item.state);
      setSelectedHistoryId(item.id);
      setStatusWithTime(`Restored: ${item.label}`);
    },
    [loadState, setSelectedHistoryId, setStatusWithTime],
  );

  const clearHistory = useCallback(() => {
    setHistory([]);
    safeLocalStorage.remove(HISTORY_KEY);
    setStatusWithTime("History cleared");
  }, [setHistory, setStatusWithTime]);

  const applyQuickFix = useCallback(
    (label) => {
      const line = fixes[label];
      if (!line) return;
      setRules((old) => (old.trim() ? `${old.trim()}\n${line}` : line));
      setStatusWithTime(`Applied fix: ${label}`);
    },
    [setRules, setStatusWithTime],
  );

  const coProducer = useCallback(
    (action) => {
      patch(buildCoProducerQuickTweakPatch(action));
      setStatusWithTime(action);
    },
    [patch, setStatusWithTime],
  );

  const buildCoProducerAI = useCallback(() => {
    const { output, patch: coPatch } = buildCoProducerAdvisoryReport({
      selectedGenres,
      selectedSounds,
      selectedRhythms,
      mood,
      moodWords,
      tempo,
      vocal,
      lyricTheme,
      promptIntensity,
      mode,
    });
    patch(coPatch);
    setCoProducerOutput(output);
    setNotes(output);
    addHistory("Co-Producer AI report", output, currentState);
    setStatusWithTime("Co-Producer AI updated prompt");
  }, [
    addHistory,
    currentState,
    lyricTheme,
    mode,
    mood,
    moodWords,
    patch,
    promptIntensity,
    selectedGenres,
    selectedRhythms,
    selectedSounds,
    setCoProducerOutput,
    setNotes,
    setStatusWithTime,
    tempo,
    vocal,
  ]);

  const generateHooks = useCallback(
    (bumpVariant = false) => {
      const nextSeed = bumpVariant ? lyricVariantSeed + 1 : lyricVariantSeed;
      if (bumpVariant) setLyricVariantSeed(nextSeed);
      const result = generateCoProducerHooks({
        vocal,
        lyricStyle,
        lyricTheme,
        lyricLanguage,
        mood,
        idea,
        variantSeed: nextSeed,
        ...coProducerVoiceFields(),
      });
      setGeneratedHooks(result.hooks);
      setGeneratedHooksStyle(result.styleLabel);
      if (vocal === "Instrumental") {
        setStatusWithTime("Hooks skipped in instrumental mode");
        return;
      }
      setStatusWithTime(`Generated ${result.styleLabel} hook ideas`);
    },
    [
      idea,
      lyricLanguage,
      lyricStyle,
      lyricTheme,
      lyricVariantSeed,
      mood,
      setGeneratedHooks,
      setGeneratedHooksStyle,
      setLyricVariantSeed,
      setStatusWithTime,
      vocal,
      coProducerVoiceFields,
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
      coProducerVoiceFields,
    ],
  );

  const generateExampleLyrics = useCallback(() => runGenerateLyrics(false), [runGenerateLyrics]);
  const shuffleExampleLyrics = useCallback(() => runGenerateLyrics(true), [runGenerateLyrics]);

  const generateVariations = useCallback(() => {
    captureSnapshot("before variations");
    const extraSounds = [
      "Distorted bass",
      "Glitch FX",
      "Dub delays",
      "Noise atmosphere",
      "Big drums",
      "Vinyl texture",
      "Bright leads",
    ];
    const extraRhythms = ["Breakbeat", "Halftime", "Rolling", "Off-grid", "Syncopated"];
    const modes = ["Control", "Hybrid", "Chaos"];
    const output = [];
    for (let i = 0; i < variationCount; i++) {
      const soundAdd = extraSounds[(i + selectedSounds.length) % extraSounds.length];
      const rhythmAdd = extraRhythms[(i + selectedRhythms.length) % extraRhythms.length];
      const modePick = modes[(i + modes.indexOf(mode) + 3) % modes.length];
      const varPrompt = `Core:
${selectedGenres.join(" + ") || "Electronic"}

Tempo:
${tempo}

Mood:
${moodWords}, variation energy ${Math.min(100, mood.energy + (i + 1) * 4)}

Sound:
${uniq([...selectedSounds, soundAdd]).join(", ")}

Rhythm:
${uniq([...selectedRhythms, rhythmAdd]).join(", ")}

Vocals:
${vocalText}

Structure:
${structure}

Production / Rules:
${rules}

Prompt Intensity:
${modePick === "Chaos" ? "experimental, bold, unstable evolution" : intensityText}

Creative Goal:
${idea}

${vocal !== "Instrumental" ? lyricPrompt : "Lyrics: instrumental only."}

${audioAnalysis ? `Audio Source Analysis:
${audioAnalysis.summary}` : ""}

${imageAnalysis ? `Image Source Analysis:
${imageAnalysis.summary}` : ""}

Generation Mode:
${modePick} mode.

Variation Note:
Variation ${i + 1}: keep the core identity, change texture and movement without losing the main style.`;
      output.push({ id: Date.now() + i, title: `Variation ${i + 1}`, prompt: varPrompt });
    }
    setVariations(output);
    addHistory("Generated variations", output[0]?.prompt || prompt, currentState);
    setStatusWithTime(`Generated ${variationCount} variations`);
  }, [
    addHistory,
    audioAnalysis,
    captureSnapshot,
    currentState,
    idea,
    imageAnalysis,
    intensityText,
    lyricPrompt,
    mode,
    mood,
    moodWords,
    prompt,
    rules,
    selectedGenres,
    selectedRhythms,
    selectedSounds,
    setStatusWithTime,
    setVariations,
    structure,
    tempo,
    variationCount,
    vocal,
    vocalText,
  ]);

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
    coProducerVoiceFields,
  ]);

  const resetAll = useCallback(() => {
    captureSnapshot("before reset");
    resetBlank();
    resetAnalyzers();
    clearCharacterVoiceStudioSessionOnReset();
    lastAutosavePayloadRef.current = "";
    safeLocalStorage.remove(STORAGE_KEY);
    safeLocalStorage.remove(HISTORY_KEY);
    resetSplash();
    setStatusWithTime("Reset — blank slate on guided step 1; pick each prompt yourself");
  }, [
    captureSnapshot,
    lastAutosavePayloadRef,
    resetAnalyzers,
    resetBlank,
    resetSplash,
    setStatusWithTime,
  ]);

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
    addHistory,
    addLyricsFromInstrumentalTrack,
    applyGenreAnchors,
    applyPreset,
    applyQuickFix,
    buildCoProducerAI,
    clearHistory,
    coProducer,
    copyPrompt,
    deleteCustomPreset,
    exportProject,
    fixSunoWarnings,
    generateExampleLyrics,
    generateHooks,
    generateVariations,
    generateVoiceStyleFromNames,
    handoffTrackToVoiceCharacterStudio,
    importProject,
    loadPresetObject,
    resetAll,
    restoreHistory,
    saveCustomPreset,
    saveProject,
    shuffleExampleLyrics,
    toggle,
  };
}
