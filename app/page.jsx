"use client";

import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { AppHeader, SplashOverlay } from "./components/app-shell";
import { ActionToast } from "./components/action-toast";
import { SunoGuidedPath } from "./components/suno-guided-path";
import { StylePromptPicker } from "./components/suno-english-style-prompt-picker";
import { AudioTrackEditor } from "./components/audio-track-editor";
import { DropBox, Panel, Pill, SearchablePillGrid, Slider, TextBox } from "./components/ui-blocks";
import { useAnalyzers } from "./hooks/use-analyzers";
import { useClipboard } from "./hooks/use-clipboard";
import { useProjectState } from "./hooks/use-project-state";
import { usePromptPipeline } from "./hooks/use-prompt-pipeline";
import { ProjectWorkspaceContext } from "./context/project-workspace-context";
import { PageSidebarLeft } from "./components/page-sidebar-left";
import { PageWorkspaceCenter } from "./components/page-workspace-center";
import { PageSidebarRight } from "./components/page-sidebar-right";
import { useSplashOverlay } from "./hooks/use-splash-seen";
import { useStatusMessage } from "./hooks/use-status-message";
import { SUNO_AUTO_FIX_DEFAULTS } from "./lib/suno-rules";
import {
  SUNO_LIMITS_NOTE,
  SUNO_LYRICS_CHAR_TYPICAL_MAX,
  SUNO_LYRICS_CHAR_WARN,
  SUNO_STYLE_CHAR_CAP,
  SUNO_STYLE_CHAR_WARN,
} from "./lib/suno-limits";
import { IMAGE_ANALYZER_DISCLAIMER } from "./lib/analyzer-disclaimer";
import {
  buildInstrumentalLyricsScaffold,
  buildLyricThemeFromAnalysis,
  getGuidedLyricsStepIndex,
  inferStructureFromTrack,
  stripInstrumentalOnlyRules,
  suggestLyricStyleFromAnalysis,
  suggestVocalRoleFromAnalysis,
} from "./lib/instrumental-lyrics-from-track";
import { useUndoSnapshot } from "./hooks/use-undo-snapshot";
import { VariationCompare } from "./components/variation-compare";
import {
  CoProducerHooksBlock,
  CoProducerLlmSettings,
  CoProducerLyricsBlock,
} from "./components/co-producer-lyrics-block";
import {
  SUPPORTED_AUDIO_ACCEPT,
  SUPPORTED_AUDIO_LABEL,
  SUPPORTED_IMAGE_ACCEPT,
  SUPPORTED_IMAGE_LABEL,
} from "./lib/analyzer-file-types";
import { collectGenreAnchors } from "./lib/suno-language-index";
import {
  migrateImportedProject,
  migratePersistedProject,
  shouldHardResetProjectOnVersionChange,
  slimStateForHistory,
  slimStateForPersistence,
} from "./lib/project-persistence";
import { safeLocalStorage, storageFailureMessage } from "./lib/safe-local-storage";
import {
  APP_VERSION,
  AUTHOR,
  BLANK_STATE,
  DEFAULT_STATE,
  fixes,
  genreOptions,
  HISTORY_KEY,
  lyricModeOptions,
  lyricStyleOptions,
  PRESET_KEY,
  promptFormatOptions,
  rhythmOptions,
  soundOptions,
  STORAGE_KEY,
  stylePresets,
  vocalOptions,
} from "./lib/music-config";
import { SUNO_LYRIC_LANGUAGE_GROUPS, normalizeLyricLanguage } from "./lib/suno-lyric-languages";
import {
  SUNO_GENRE_GROUPS,
  SUNO_GENRE_WHEEL_COUNT,
  SUNO_INSTRUMENT_GROUPS,
  SUNO_RHYTHM_GROUPS,
} from "./lib/suno-music-styles";
import {
  bracketizeSunoPromptBlock,
  bracketizeSunoPromptLine,
  buildMoodWords,
  uniq,
} from "./lib/music-helpers";
import { generateCoProducerLyrics, generateCoProducerHooks, getLyricStyleDirection, mergeInstrumentalScaffoldWithStyleLyrics } from "./lib/lyric-generator";
import {
  DEFAULT_LLM_SETTINGS,
  generateLyricsWithLlm,
  isCoProducerLlmReady,
  loadCoProducerLlmSettings,
  saveCoProducerLlmSettings,
} from "./lib/co-producer-llm";
import {
  buildSunoVoiceStyleLine,
  FAMOUS_VOICE_PRESETS,
  formatPublicName,
} from "./lib/suno-voice-style";

export default function Page() {
  const { statusMessage: saveStatus, setStatusMessage, setStatusWithTime, toast, clearToast } = useStatusMessage("Not saved yet");
  const {
    patch,
    load: loadProjectState,
    resetBlank,
    idea,
    setIdea,
    tempo,
    setTempo,
    structure,
    setStructure,
    selectedGenres,
    setSelectedGenres,
    selectedRhythms,
    setSelectedRhythms,
    selectedSounds,
    setSelectedSounds,
    vocal,
    setVocal,
    mode,
    setMode,
    proMode,
    setProMode,
    promptIntensity,
    setPromptIntensity,
    variationCount,
    setVariationCount,
    rules,
    setRules,
    notes,
    setNotes,
    copied,
    setCopied,
    scores,
    setScores,
    mood,
    setMood,
    lyricTheme,
    setLyricTheme,
    lyricLanguage,
    setLyricLanguage,
    lyricStructure,
    setLyricStructure,
    lyricStyle,
    setLyricStyle,
    lyricDensity,
    setLyricDensity,
    promptFormat,
    setPromptFormat,
    promptEngine,
    setPromptEngine,
    coProducerOutput,
    setCoProducerOutput,
    generatedLyrics,
    setGeneratedLyrics,
    generatedLyricsStyle,
    setGeneratedLyricsStyle,
    generatedHooks,
    setGeneratedHooks,
    generatedHooksStyle,
    setGeneratedHooksStyle,
    lyricVariantSeed,
    setLyricVariantSeed,
    lyricsGenerateBusy,
    setLyricsGenerateBusy,
    coProducerLlmSettings,
    setCoProducerLlmSettings,
    lyricMode,
    setLyricMode,
    voiceRefFirstName,
    setVoiceRefFirstName,
    voiceRefLastName,
    setVoiceRefLastName,
    voiceStyleLine,
    setVoiceStyleLine,
    presetName,
    setPresetName,
    customPresets,
    setCustomPresets,
    history,
    setHistory,
    variations,
    setVariations,
    selectedHistoryId,
    setSelectedHistoryId,
    guidedStep,
    setGuidedStep,
    instrumentalVocalFx,
    setInstrumentalVocalFx,
  } = useProjectState();
  const { showSplash, dismissSplash, resetSplash } = useSplashOverlay();

  const applyAnalyzerPatch = useCallback((analyzerPatch) => {
    patch(analyzerPatch);
  }, [patch]);

  const lastAutosavePayloadRef = useRef("");
  const {
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
    exportEnhancedAudio,
    canvasRef,
    clearAudioAnalysis,
    clearImageAnalysis,
    imageAnalysis,
    imagePreview,
    resetAnalyzers,
    setAudioAnalysis,
    setImageAnalysis,
    updateAudioAnalysis,
  } = useAnalyzers({
    promptEngine,
    setGuidedStep,
    applyAnalyzerPatch,
    setStatusWithTime,
  });

  const currentState = useMemo(
    () => ({
      appVersion: APP_VERSION,
      idea,
      tempo,
      structure,
      selectedGenres,
      selectedRhythms,
      selectedSounds,
      vocal,
      mode,
      proMode,
      promptIntensity,
      variationCount,
      rules,
      notes,
      scores,
      mood,
      audioAnalysis,
      imageAnalysis,
      lyricTheme,
      lyricLanguage,
      lyricStructure,
      lyricStyle,
      lyricDensity,
      promptFormat,
      promptEngine,
      coProducerOutput,
      generatedLyrics,
      generatedLyricsStyle,
      generatedHooks,
      generatedHooksStyle,
      lyricVariantSeed,
      lyricMode,
      voiceRefFirstName,
      voiceRefLastName,
      voiceStyleLine,
      instrumentalVocalFx,
      guidedStep,
      variations,
      history,
      selectedHistoryId,
    }),
    [
      idea,
      tempo,
      structure,
      selectedGenres,
      selectedRhythms,
      selectedSounds,
      vocal,
      mode,
      proMode,
      promptIntensity,
      variationCount,
      rules,
      notes,
      scores,
      mood,
      audioAnalysis,
      imageAnalysis,
      lyricTheme,
      lyricLanguage,
      lyricStructure,
      lyricStyle,
      lyricDensity,
      promptFormat,
      promptEngine,
      coProducerOutput,
      generatedLyrics,
      generatedLyricsStyle,
      generatedHooks,
      generatedHooksStyle,
      lyricVariantSeed,
      lyricMode,
      voiceRefFirstName,
      voiceRefLastName,
      voiceStyleLine,
      instrumentalVocalFx,
      guidedStep,
      variations,
      history,
      selectedHistoryId,
    ],
  );

  const loadState=useCallback((data)=>{
    loadProjectState(data);
    if (data.audioAnalysis) setAudioAnalysis(data.audioAnalysis);
    else clearAudioAnalysis();
    if (data.imageAnalysis) setImageAnalysis(data.imageAnalysis);
    else clearImageAnalysis();
  }, [clearAudioAnalysis, clearImageAnalysis, loadProjectState, setAudioAnalysis, setImageAnalysis]);

  const { captureSnapshot, revertSnapshot } = useUndoSnapshot(
    () => currentState,
    loadState,
    setStatusWithTime,
  );

  const addLyricsFromInstrumentalTrack = useCallback(() => {
    if (!audioAnalysis) {
      setStatusWithTime("Upload an instrumental track first");
      return;
    }
    captureSnapshot("before add lyrics to track");
    applyAudioToSunoStyle();

    const theme = buildLyricThemeFromAnalysis(audioAnalysis);
    const structure = inferStructureFromTrack(audioAnalysis);
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
      lyricStructure: structure,
      lyricDensity,
      mood,
      moodWords: moodWordsLocal,
      selectedGenres,
      idea,
      variantSeed: 0,
    };
    const coProd = generateCoProducerLyrics(coInput);
    const hookResult = generateCoProducerHooks(coInput);
    const merged = mergeInstrumentalScaffoldWithStyleLyrics(scaffold, coProd);

    setInstrumentalVocalFx(false);
    setVocal(vocalRole);
    setLyricTheme(theme);
    setLyricStyle(suggestedStyle);
    setLyricMode("Structured Song");
    setLyricStructure(structure);
    setStructure(structure);
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
    audioAnalysis,
    applyAudioToSunoStyle,
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
  ]);

  const resetAll=()=>{
    captureSnapshot("before reset");
    resetBlank();
    resetAnalyzers();
    lastAutosavePayloadRef.current = "";
    safeLocalStorage.remove(STORAGE_KEY);
    safeLocalStorage.remove(HISTORY_KEY);
    resetSplash();
    setStatusWithTime("Reset — blank slate on guided step 1; pick each prompt yourself");
  };

  useEffect(() => {
    if (!showSplash) return;
    const timer = window.setTimeout(dismissSplash, 1800);
    // Failsafe for environments where timers are delayed/throttled.
    const fallback = window.setTimeout(dismissSplash, 3500);
    window.addEventListener("pointerdown", dismissSplash, { once: true });
    window.addEventListener("keydown", dismissSplash, { once: true });
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(fallback);
      window.removeEventListener("pointerdown", dismissSplash);
      window.removeEventListener("keydown", dismissSplash);
    };
  }, [dismissSplash, showSplash]);

  useEffect(() => {
    let cancelled = false;
    const t = window.setTimeout(() => {
      if (cancelled) return;
      try {
        const saved = safeLocalStorage.get(STORAGE_KEY, null);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed?.appVersion !== APP_VERSION) {
            if (shouldHardResetProjectOnVersionChange(parsed.appVersion, APP_VERSION)) {
              safeLocalStorage.remove(STORAGE_KEY);
              resetAnalyzers();
              patch({ variations: [], guidedStep: 0 });
              lastAutosavePayloadRef.current = "";
              setStatusWithTime(
                `Major upgrade to v${APP_VERSION} — project cleared (presets and history kept)`,
              );
            } else {
              loadState(migratePersistedProject(parsed, APP_VERSION));
              setStatusWithTime(`Upgraded saved project to v${APP_VERSION}`);
            }
          } else {
            loadState(parsed);
            setStatusWithTime("Loaded saved project");
          }
        }
        const presets = safeLocalStorage.getJSON(PRESET_KEY, null);
        if (presets) setCustomPresets(presets);
        const hist = safeLocalStorage.getJSON(HISTORY_KEY, null);
        if (hist) setHistory(hist);
      } catch {
        setStatusWithTime("Could not load saved data");
      }
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [loadState, patch, resetAnalyzers, setCustomPresets, setHistory, setStatusWithTime]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      try {
        const payload = JSON.stringify(slimStateForPersistence(currentState));
        if (payload === lastAutosavePayloadRef.current) return;
        const result = safeLocalStorage.set(STORAGE_KEY, payload);
        if (!result.ok) {
          setStatusWithTime(storageFailureMessage(result), "error");
          return;
        }
        lastAutosavePayloadRef.current = payload;
        setStatusMessage(`Autosaved at ${new Date().toLocaleTimeString()}`);
      } catch {
        setStatusWithTime("Autosave failed", "error");
      }
    }, 2000);
    return () => window.clearTimeout(timeoutId);
  }, [currentState, setStatusMessage, setStatusWithTime]);

  useEffect(() => {
    if (promptEngine === "Suno-like") return;
    const t = window.setTimeout(() => {
      setGuidedStep(0);
    }, 0);
    return () => window.clearTimeout(t);
  }, [promptEngine, setGuidedStep]);

  const toggle=(item,list,setter)=>setter(list.includes(item)?list.filter(x=>x!==item):[...list,item]);

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
      audioAnalysis,
      imageAnalysis,
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
      audioAnalysis,
      imageAnalysis,
      voiceStyleLine,
      voiceRefFirstName,
      voiceRefLastName,
      generatedLyrics,
    ],
  );

  const {
    moodWords,
    intensityText,
    vocalText,
    lyricPrompt,
    prompt,
    sunoFieldSlices,
    sunoSlices,
    sunoWarnings,
    sunoGuidedInput,
    voiceStyleCompact,
    sourcePrompt,
  } = usePromptPipeline(pipelineInput);

  const generateVoiceStyleFromNames = () => {
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
  };

  const fixSunoWarnings = () => {
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
  };

  const applyGenreAnchors = () => {
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
        const merged = uniq([...prev.split("\n").map((x) => x.trim()).filter(Boolean), ...ruleAdditions]);
        return merged.join("\n");
      });
    }
    setStatusWithTime("Applied genre anchors");
  };

  const avgScore=((scores.bass+scores.rhythm+scores.identity+scores.clarity)/4).toFixed(1);

  const { copyToClipboard } = useClipboard(setStatusWithTime);

  const saveProject=()=>{ 
    const slim = slimStateForPersistence(currentState);
    const payload = JSON.stringify(slim, null, 2);
    const result = safeLocalStorage.set(STORAGE_KEY, payload);
    if (!result.ok) {
      setStatusWithTime(storageFailureMessage(result), "error");
      return;
    }
    lastAutosavePayloadRef.current = payload;
    setStatusWithTime("Saved"); 
  };
  const exportProject=()=>{ const blob=new Blob([JSON.stringify(currentState,null,2)],{type:"application/json"}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download="ai-music-project.json"; a.click(); URL.revokeObjectURL(url); setStatusWithTime("Exported JSON project"); };
  const importProject=(event)=>{ const file=event.target.files?.[0]; if(!file) return; const reader=new FileReader(); reader.onload=()=>{ try{ captureSnapshot("before import"); const raw=JSON.parse(String(reader.result)); loadState(migrateImportedProject(raw, APP_VERSION)); setStatusWithTime("Imported JSON project"); }catch{ setStatusWithTime("Import failed", "error"); } }; reader.readAsText(file); };

  const saveCustomPreset=()=>{
    const name=presetName.trim(); if(!name){ setStatusWithTime("Preset name missing"); return; }
    const next={
      ...customPresets,
      [name]:{
        genres:selectedGenres,
        rhythms:selectedRhythms,
        sounds:selectedSounds,
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
  };

  const loadPresetObject=(name,p)=>{
    setSelectedGenres(p.genres ?? DEFAULT_STATE.selectedGenres); setSelectedRhythms(p.rhythms ?? DEFAULT_STATE.selectedRhythms); setSelectedSounds(p.sounds ?? DEFAULT_STATE.selectedSounds);
    setVocal(p.vocal ?? DEFAULT_STATE.vocal);
    setInstrumentalVocalFx(p.instrumentalVocalFx ?? false);
    setTempo(p.tempo ?? DEFAULT_STATE.tempo); setStructure(p.structure ?? DEFAULT_STATE.structure);
    if(p.mood) setMood(p.mood); if(p.rules) setRules(p.rules); if(p.mode) setMode(p.mode); if(typeof p.promptIntensity==="number") setPromptIntensity(p.promptIntensity);
    setStatusWithTime(`Loaded preset: ${name}`);
  };

  const deleteCustomPreset=(name)=>{ const next={...customPresets}; delete next[name]; setCustomPresets(next); const result = safeLocalStorage.setJSON(PRESET_KEY, next); if (!result.ok) { setStatusWithTime(storageFailureMessage(result), "error"); return; } setStatusWithTime(`Deleted preset: ${name}`); };
  const applyPreset=(name)=>{ captureSnapshot(`before preset ${name}`); loadPresetObject(name, stylePresets[name]); };

  const addHistory=(label,promptText=prompt,state=currentState)=>{
    const item={id:Date.now(),label,time:new Date().toLocaleTimeString(),prompt:promptText,state:slimStateForHistory(state),avgScore};
    const next=[item,...history].slice(0,12); setHistory(next); const result = safeLocalStorage.setJSON(HISTORY_KEY, next); if (!result.ok) setStatusWithTime(storageFailureMessage(result), "error");
  };

  const copyPrompt=async()=>{ const ok = await copyToClipboard(prompt, "Prompt copied"); if(!ok) return; setCopied(true); addHistory("Copied prompt"); setTimeout(()=>setCopied(false),1200); };
  const restoreHistory=(item)=>{ loadState(item.state); setSelectedHistoryId(item.id); setStatusWithTime(`Restored: ${item.label}`); };
  const clearHistory=()=>{ setHistory([]); safeLocalStorage.remove(HISTORY_KEY); setStatusWithTime("History cleared"); };

  const applyQuickFix = (label) => {
    const line = fixes[label];
    if (!line) return;
    setRules((old) => (old.trim() ? `${old.trim()}\n${line}` : line));
    setStatusWithTime(`Applied fix: ${label}`);
  };

  const coProducer=(action)=>{
    if(action==="Make darker") setMood(m=>({...m,darkness:Math.min(100,m.darkness+15)}));
    if(action==="More aggressive") setMood(m=>({...m,aggression:Math.min(100,m.aggression+15),energy:Math.min(100,m.energy+10)}));
    if(action==="More minimal") setMood(m=>({...m,complexity:Math.max(0,m.complexity-20)}));
    if(action==="More cinematic"){ setSelectedGenres(g=>uniq([...g,"Cinematic"])); setSelectedSounds(s=>uniq([...s,"Orchestral strings","Big drums"])); setMood(m=>({...m,space:Math.min(100,m.space+15),emotion:Math.min(100,m.emotion+10)})); }
    if(action==="More club"){ setSelectedRhythms(r=>uniq([...r,"4/4"])); setSelectedSounds(s=>uniq([...s,"Heavy sub bass","Big drums"])); setMood(m=>({...m,energy:Math.min(100,m.energy+15)})); }
    setStatusWithTime(action);
  };

  const buildCoProducerAI = () => {
    const suggestions = [];
    const fixesToApply = [];

    if (selectedGenres.length > 3) suggestions.push("Too many genres can weaken identity. Keep one main genre and one secondary influence.");
    if (selectedSounds.length > 8) suggestions.push("Sound list is very long. Prioritize bass, drums, atmosphere, and one signature texture.");
    if (mood.energy > 75 && !selectedRhythms.includes("4/4") && !selectedRhythms.includes("Breakbeat")) suggestions.push("High energy needs a stronger rhythm anchor: add 4/4 or Breakbeat.");
    if (mood.darkness > 65 && !selectedSounds.includes("Dark pads")) fixesToApply.push("Dark pads");
    if (mood.aggression > 65 && !selectedSounds.includes("Distorted bass")) fixesToApply.push("Distorted bass");
    if (mood.space > 65 && !selectedSounds.includes("Dub delays")) fixesToApply.push("Dub delays");
    if (vocal !== "Instrumental" && lyricTheme.length < 12) suggestions.push("Lyric theme is short. Add clearer story, emotion, or repeated phrase direction.");
    if (promptIntensity > 75 && mode === "Control") suggestions.push("Prompt intensity is high but mode is Control. Switch to Hybrid or lower intensity.");

    const moodDirective = mood.darkness > 65
      ? "Lean into dark imagery, low-end pressure, shadowy atmosphere, and mechanical tension."
      : "Keep the mood brighter, clearer, and more open.";

    const output = `CO-PRODUCER AI REPORT
Main identity: ${selectedGenres[0] || "Electronic"} with ${selectedGenres[1] || "modern"} influence.
Best tempo target: ${tempo}
Mood translation: ${moodWords}
Sound focus: ${selectedSounds.slice(0, 5).join(", ") || "bass, drums, atmosphere"}

Recommended direction:
${moodDirective}

Fixes:
${suggestions.length ? suggestions.map((x, i) => `${i + 1}. ${x}`).join("\n") : "Prompt is balanced. Generate 3 variations and score the strongest one."}

Auto-added sound ideas:
${fixesToApply.length ? fixesToApply.join(", ") : "No extra sound modules needed."}`;

    if (fixesToApply.length) setSelectedSounds(s => uniq([...s, ...fixesToApply]));
    if (mood.energy > 75) setSelectedRhythms(r => uniq([...r, "4/4"]));
    if (promptIntensity > 75 && mode === "Control") setMode("Hybrid");

    setCoProducerOutput(output);
    setNotes(output);
    addHistory("Co-Producer AI report", output, currentState);
    setStatusWithTime("Co-Producer AI updated prompt");
  };

  const generateHooks = (bumpVariant = false) => {
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
    });
    setGeneratedHooks(result.hooks);
    setGeneratedHooksStyle(result.styleLabel);
    if (vocal === "Instrumental") {
      setStatusWithTime("Hooks skipped in instrumental mode");
      return;
    }
    setStatusWithTime(`Generated ${result.styleLabel} hook ideas`);
  };

  const runGenerateLyrics = async (bumpVariant = false) => {
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
  };

  const generateExampleLyrics = () => runGenerateLyrics(false);
  const shuffleExampleLyrics = () => runGenerateLyrics(true);

  const generateVariations=()=>{
    captureSnapshot("before variations");
    const extraSounds=["Distorted bass","Glitch FX","Dub delays","Noise atmosphere","Big drums","Vinyl texture","Bright leads"];
    const extraRhythms=["Breakbeat","Halftime","Rolling","Off-grid","Syncopated"];
    const modes=["Control","Hybrid","Chaos"];
    const output=[];
    for(let i=0;i<variationCount;i++){
      const soundAdd=extraSounds[(i+selectedSounds.length)%extraSounds.length];
      const rhythmAdd=extraRhythms[(i+selectedRhythms.length)%extraRhythms.length];
      const modePick=modes[(i+modes.indexOf(mode)+3)%modes.length];
      const varPrompt=`Core:
${selectedGenres.join(" + ") || "Electronic"}

Tempo:
${tempo}

Mood:
${moodWords}, variation energy ${Math.min(100,mood.energy+(i+1)*4)}

Sound:
${uniq([...selectedSounds,soundAdd]).join(", ")}

Rhythm:
${uniq([...selectedRhythms,rhythmAdd]).join(", ")}

Vocals:
${vocalText}

Structure:
${structure}

Production / Rules:
${rules}

Prompt Intensity:
${modePick==="Chaos" ? "experimental, bold, unstable evolution" : intensityText}

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
Variation ${i+1}: keep the core identity, change texture and movement without losing the main style.`;
      output.push({id:Date.now()+i,title:`Variation ${i+1}`,prompt:varPrompt});
    }
    setVariations(output); addHistory("Generated variations",output[0]?.prompt || prompt,currentState); setStatusWithTime(`Generated ${variationCount} variations`);
  };

  const workspace = {
    addHistory,
    addLyricsFromInstrumentalTrack,
    analyzeAudioFile,
    analyzeImageFile,
    applyAudioToSunoStyle,
    applyGenreAnchors,
    applyImageToSunoStyle,
    applyPreset,
    applyQuickFix,
    attachAudioFile,
    audioAnalysis,
    audioExportBusy,
    audioExportProgress,
    audioLoudness,
    audioLoudnessBusy,
    audioPreviewUrl,
    buildCoProducerAI,
    clearAudioAnalysis,
    clearHistory,
    clearImageAnalysis,
    captureSnapshot,
    coProducer,
    coProducerLlmSettings,
    coProducerOutput,
    copied,
    copyPrompt,
    copyToClipboard,
    customPresets,
    deleteCustomPreset,
    exportEnhancedAudio,
    exportProject,
    fixSunoWarnings,
    generateExampleLyrics,
    generateHooks,
    generateVariations,
    generateVoiceStyleFromNames,
    generatedHooks,
    generatedHooksStyle,
    generatedLyrics,
    generatedLyricsStyle,
    guidedStep,
    history,
    idea,
    imageAnalysis,
    imagePreview,
    importProject,
    instrumentalVocalFx,
    intensityText,
    loadPresetObject,
    lyricDensity,
    lyricLanguage,
    lyricMode,
    lyricPrompt,
    lyricStructure,
    lyricStyle,
    lyricTheme,
    lyricsGenerateBusy,
    mode,
    mood,
    notes,
    presetName,
    proMode,
    prompt,
    promptEngine,
    promptFormat,
    promptIntensity,
    resetAll,
    restoreHistory,
    revertSnapshot,
    rules,
    saveCustomPreset,
    saveProject,
    scores,
    selectedGenres,
    selectedHistoryId,
    selectedRhythms,
    selectedSounds,
    setCoProducerLlmSettings,
    setCoProducerOutput,
    setCopied,
    setGeneratedLyrics,
    setGuidedStep,
    setIdea,
    setInstrumentalVocalFx,
    setLyricDensity,
    setLyricLanguage,
    setLyricMode,
    setLyricStructure,
    setLyricStyle,
    setLyricTheme,
    setMode,
    setMood,
    setNotes,
    setPresetName,
    setProMode,
    setPromptEngine,
    setPromptFormat,
    setPromptIntensity,
    setRules,
    setScores,
    setSelectedGenres,
    setSelectedRhythms,
    setSelectedSounds,
    setStatusWithTime,
    setStructure,
    setTempo,
    setVariationCount,
    setVoiceRefFirstName,
    setVoiceRefLastName,
    setVoiceStyleLine,
    setVocal,
    shuffleExampleLyrics,
    sourcePrompt,
    structure,
    sunoFieldSlices,
    sunoGuidedInput,
    sunoSlices,
    sunoWarnings,
    tempo,
    toggle,
    updateAudioAnalysis,
    variationCount,
    variations,
    vocal,
    voiceRefFirstName,
    voiceRefLastName,
    voiceStyleCompact,
    voiceStyleLine,
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#0b0d10] p-4 text-white md:p-8">
      {showSplash && (
        <SplashOverlay
          onDismiss={() => {
            dismissSplash();
            setStatusWithTime("Ready — build your prompt step by step", "info");
          }}
        />
      )}

      <ActionToast toast={toast} onDismiss={clearToast} />

      <canvas ref={canvasRef} className="hidden"/>
      <div className="fixed inset-0 pointer-events-none opacity-40" style={{background:"radial-gradient(circle at 18% 0%, rgba(184,115,51,.25), transparent 34%), radial-gradient(circle at 82% 12%, rgba(34,211,238,.16), transparent 36%), linear-gradient(135deg, rgba(255,255,255,.05), transparent 35%)"}}/>
      <div className="relative mx-auto max-w-7xl pb-12">
        <AppHeader
          appVersion={APP_VERSION}
          avgScore={avgScore}
          saveStatus={saveStatus}
          statusPulseKey={toast?.tick ?? 0}
        />

        <ProjectWorkspaceContext.Provider value={workspace}>
          <div className="grid gap-4 lg:grid-cols-[300px_1fr_380px]">
            <PageSidebarLeft />
            <PageWorkspaceCenter />
            <PageSidebarRight />
          </div>
        </ProjectWorkspaceContext.Provider>

      </div>
      <div className="fixed bottom-3 left-6 z-50 rounded-full border border-orange-400/30 bg-black/50 px-3 py-1 text-xs font-bold text-orange-300 backdrop-blur">Version {APP_VERSION}</div>
      <div className="fixed bottom-3 right-6 z-50 rounded-full border border-white/10 bg-black/50 px-3 py-1 text-xs text-white/60 backdrop-blur">Created by <span className="font-bold text-orange-300">{AUTHOR}</span></div>
    </main>
  );
}
