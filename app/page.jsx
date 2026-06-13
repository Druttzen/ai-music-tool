"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AppHeader, SplashOverlay } from "./components/app-shell";
import { ActionToast } from "./components/action-toast";
import { SunoGuidedPath } from "./components/suno-guided-path";
import { StylePromptPicker } from "./components/suno-english-style-prompt-picker";
import { AudioTrackEditor } from "./components/audio-track-editor";
import { DropBox, Panel, Pill, SearchablePillGrid, Slider, TextBox } from "./components/ui-blocks";
import { useAnalyzers } from "./hooks/use-analyzers";
import { useClipboard } from "./hooks/use-clipboard";
import { usePromptPipeline } from "./hooks/use-prompt-pipeline";
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

const SunoLanguageIndexPanel = dynamic(
  () =>
    import("./components/suno-language-index-panel").then((mod) => ({
      default: mod.SunoLanguageIndexPanel,
    })),
  {
    ssr: false,
    loading: () => (
      <Panel title="Suno Language Index" hint="Loading reference…">
        <p className="text-xs text-white/45">Loading vocabulary index…</p>
      </Panel>
    ),
  },
);

export default function Page() {
  const [idea,setIdea]=useState(DEFAULT_STATE.idea);
  const [tempo,setTempo]=useState(DEFAULT_STATE.tempo);
  const [structure,setStructure]=useState(DEFAULT_STATE.structure);
  const [selectedGenres,setSelectedGenres]=useState(DEFAULT_STATE.selectedGenres);
  const [selectedRhythms,setSelectedRhythms]=useState(DEFAULT_STATE.selectedRhythms);
  const [selectedSounds,setSelectedSounds]=useState(DEFAULT_STATE.selectedSounds);
  const [vocal,setVocal]=useState(DEFAULT_STATE.vocal);
  const [mode,setMode]=useState(DEFAULT_STATE.mode);
  const [proMode,setProMode]=useState(DEFAULT_STATE.proMode);
  const [promptIntensity,setPromptIntensity]=useState(DEFAULT_STATE.promptIntensity);
  const [variationCount,setVariationCount]=useState(DEFAULT_STATE.variationCount);
  const [rules,setRules]=useState(DEFAULT_STATE.rules);
  const [notes,setNotes]=useState(DEFAULT_STATE.notes);
  const [copied,setCopied]=useState(false);
  const { statusMessage: saveStatus, setStatusMessage, setStatusWithTime, toast, clearToast } = useStatusMessage("Not saved yet");
  const [scores,setScores]=useState(DEFAULT_STATE.scores);
  const [mood,setMood]=useState(DEFAULT_STATE.mood);
  const [lyricTheme, setLyricTheme] = useState(DEFAULT_STATE.lyricTheme);
  const [lyricLanguage, setLyricLanguage] = useState(DEFAULT_STATE.lyricLanguage);
  const [lyricStructure, setLyricStructure] = useState(DEFAULT_STATE.lyricStructure);
  const [lyricStyle, setLyricStyle] = useState(DEFAULT_STATE.lyricStyle);
  const [lyricDensity, setLyricDensity] = useState(DEFAULT_STATE.lyricDensity);
  const [promptFormat, setPromptFormat] = useState(DEFAULT_STATE.promptFormat);
  const [promptEngine, setPromptEngine] = useState(DEFAULT_STATE.promptEngine ?? "Standard");
  const [coProducerOutput, setCoProducerOutput] = useState(DEFAULT_STATE.coProducerOutput);
  const [generatedLyrics, setGeneratedLyrics] = useState(DEFAULT_STATE.generatedLyrics);
  const [generatedLyricsStyle, setGeneratedLyricsStyle] = useState(
    DEFAULT_STATE.generatedLyricsStyle ?? "",
  );
  const [generatedHooks, setGeneratedHooks] = useState(DEFAULT_STATE.generatedHooks);
  const [generatedHooksStyle, setGeneratedHooksStyle] = useState(
    DEFAULT_STATE.generatedHooksStyle ?? "",
  );
  const [lyricVariantSeed, setLyricVariantSeed] = useState(DEFAULT_STATE.lyricVariantSeed ?? 0);
  const [lyricsGenerateBusy, setLyricsGenerateBusy] = useState(false);
  const [coProducerLlmSettings, setCoProducerLlmSettings] = useState(() =>
    typeof window !== "undefined" ? loadCoProducerLlmSettings() : DEFAULT_LLM_SETTINGS,
  );
  const [lyricMode, setLyricMode] = useState(DEFAULT_STATE.lyricMode);
  const [voiceRefFirstName, setVoiceRefFirstName] = useState(
    DEFAULT_STATE.voiceRefFirstName ?? "",
  );
  const [voiceRefLastName, setVoiceRefLastName] = useState(
    DEFAULT_STATE.voiceRefLastName ?? "",
  );
  const [voiceStyleLine, setVoiceStyleLine] = useState(DEFAULT_STATE.voiceStyleLine ?? "");
  const [presetName,setPresetName]=useState("");
  const [customPresets,setCustomPresets]=useState({});
  const [history,setHistory]=useState([]);
  const [variations,setVariations]=useState([]);
  const [selectedHistoryId,setSelectedHistoryId]=useState(null);
  const { showSplash, dismissSplash, resetSplash } = useSplashOverlay();

  const [guidedStep, setGuidedStep] = useState(0);
  const [instrumentalVocalFx, setInstrumentalVocalFx] = useState(DEFAULT_STATE.instrumentalVocalFx);
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
    setIdea,
    setMood,
    setNotes,
    setRules,
    setSelectedGenres,
    setSelectedRhythms,
    setSelectedSounds,
    setStatusWithTime,
    setTempo,
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
    setIdea(data.idea ?? DEFAULT_STATE.idea);
    setTempo(data.tempo ?? DEFAULT_STATE.tempo);
    setStructure(data.structure ?? DEFAULT_STATE.structure);
    setSelectedGenres(data.selectedGenres ?? DEFAULT_STATE.selectedGenres);
    setSelectedRhythms(data.selectedRhythms ?? DEFAULT_STATE.selectedRhythms);
    setSelectedSounds(data.selectedSounds ?? DEFAULT_STATE.selectedSounds);
    setVocal(data.vocal ?? DEFAULT_STATE.vocal);
    setMode(data.mode ?? DEFAULT_STATE.mode);
    setProMode(data.proMode ?? DEFAULT_STATE.proMode);
    setPromptIntensity(data.promptIntensity ?? DEFAULT_STATE.promptIntensity);
    setVariationCount(data.variationCount ?? DEFAULT_STATE.variationCount);
    setRules(data.rules ?? DEFAULT_STATE.rules);
    setNotes(data.notes ?? DEFAULT_STATE.notes);
    setScores(data.scores ?? DEFAULT_STATE.scores);
    setMood(data.mood ?? DEFAULT_STATE.mood);
    if (data.audioAnalysis) setAudioAnalysis(data.audioAnalysis);
    else clearAudioAnalysis();
    if (data.imageAnalysis) setImageAnalysis(data.imageAnalysis);
    else clearImageAnalysis();
    setLyricTheme(data.lyricTheme ?? DEFAULT_STATE.lyricTheme);
    setLyricLanguage(normalizeLyricLanguage(data.lyricLanguage ?? DEFAULT_STATE.lyricLanguage));
    setLyricStructure(data.lyricStructure ?? DEFAULT_STATE.lyricStructure);
    setLyricStyle(data.lyricStyle ?? DEFAULT_STATE.lyricStyle);
    setLyricDensity(data.lyricDensity ?? DEFAULT_STATE.lyricDensity);
    setPromptFormat(data.promptFormat ?? DEFAULT_STATE.promptFormat);
    setPromptEngine(data.promptEngine ?? DEFAULT_STATE.promptEngine ?? "Standard");
    setCoProducerOutput(data.coProducerOutput ?? DEFAULT_STATE.coProducerOutput);
    setGeneratedLyrics(data.generatedLyrics ?? DEFAULT_STATE.generatedLyrics);
    setGeneratedLyricsStyle(data.generatedLyricsStyle ?? DEFAULT_STATE.generatedLyricsStyle ?? "");
    setGeneratedHooks(data.generatedHooks ?? DEFAULT_STATE.generatedHooks);
    setGeneratedHooksStyle(data.generatedHooksStyle ?? DEFAULT_STATE.generatedHooksStyle ?? "");
    setLyricVariantSeed(data.lyricVariantSeed ?? DEFAULT_STATE.lyricVariantSeed ?? 0);
    setLyricMode(data.lyricMode ?? DEFAULT_STATE.lyricMode);
    setVoiceRefFirstName(data.voiceRefFirstName ?? DEFAULT_STATE.voiceRefFirstName ?? "");
    setVoiceRefLastName(data.voiceRefLastName ?? DEFAULT_STATE.voiceRefLastName ?? "");
    setVoiceStyleLine(data.voiceStyleLine ?? DEFAULT_STATE.voiceStyleLine ?? "");
    setInstrumentalVocalFx(data.instrumentalVocalFx ?? DEFAULT_STATE.instrumentalVocalFx);
    if (typeof data.guidedStep === "number" && !Number.isNaN(data.guidedStep)) {
      setGuidedStep(Math.max(0, data.guidedStep));
    }
    setVariations(Array.isArray(data.variations) ? data.variations : []);
    if (Array.isArray(data.history)) setHistory(data.history);
    setSelectedHistoryId(data.selectedHistoryId ?? null);
  }, [clearAudioAnalysis, clearImageAnalysis, setAudioAnalysis, setImageAnalysis]);

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
    setGuidedStep,
    setStatusWithTime,
  ]);

  const resetAll=()=>{
    captureSnapshot("before reset");
    loadState(BLANK_STATE);
    setVariations([]);
    setHistory([]);
    setSelectedHistoryId(null);
    setGeneratedLyrics("");
    setGeneratedLyricsStyle("");
    setGeneratedHooks("");
    setGeneratedHooksStyle("");
    setCoProducerOutput("");
    setLyricVariantSeed(0);
    resetAnalyzers();
    setGuidedStep(0);
    lastAutosavePayloadRef.current = "";
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(HISTORY_KEY);
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
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed?.appVersion !== APP_VERSION) {
            if (shouldHardResetProjectOnVersionChange(parsed.appVersion, APP_VERSION)) {
              localStorage.removeItem(STORAGE_KEY);
              resetAnalyzers();
              setVariations([]);
              setGuidedStep(0);
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
        const presets = localStorage.getItem(PRESET_KEY);
        if (presets) setCustomPresets(JSON.parse(presets));
        const hist = localStorage.getItem(HISTORY_KEY);
        if (hist) setHistory(JSON.parse(hist));
      } catch {
        setStatusWithTime("Could not load saved data");
      }
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [loadState, resetAnalyzers, setStatusWithTime]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      try {
        const payload = JSON.stringify(slimStateForPersistence(currentState));
        if (payload === lastAutosavePayloadRef.current) return;
        localStorage.setItem(STORAGE_KEY, payload);
        lastAutosavePayloadRef.current = payload;
        setStatusMessage(`Autosaved at ${new Date().toLocaleTimeString()}`);
      } catch {
        setStatusWithTime("Autosave failed", "error");
      }
    }, 600);
    return () => window.clearTimeout(timeoutId);
  }, [currentState, setStatusMessage, setStatusWithTime]);

  useEffect(() => {
    if (promptEngine === "Suno-like") return;
    const t = window.setTimeout(() => {
      setGuidedStep(0);
    }, 0);
    return () => window.clearTimeout(t);
  }, [promptEngine]);

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
    localStorage.setItem(STORAGE_KEY, payload);
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
    setCustomPresets(next); localStorage.setItem(PRESET_KEY,JSON.stringify(next,null,2)); setPresetName(""); setStatusWithTime(`Saved preset: ${name}`);
  };

  const loadPresetObject=(name,p)=>{
    setSelectedGenres(p.genres ?? DEFAULT_STATE.selectedGenres); setSelectedRhythms(p.rhythms ?? DEFAULT_STATE.selectedRhythms); setSelectedSounds(p.sounds ?? DEFAULT_STATE.selectedSounds);
    setVocal(p.vocal ?? DEFAULT_STATE.vocal);
    setInstrumentalVocalFx(p.instrumentalVocalFx ?? false);
    setTempo(p.tempo ?? DEFAULT_STATE.tempo); setStructure(p.structure ?? DEFAULT_STATE.structure);
    if(p.mood) setMood(p.mood); if(p.rules) setRules(p.rules); if(p.mode) setMode(p.mode); if(typeof p.promptIntensity==="number") setPromptIntensity(p.promptIntensity);
    setStatusWithTime(`Loaded preset: ${name}`);
  };

  const deleteCustomPreset=(name)=>{ const next={...customPresets}; delete next[name]; setCustomPresets(next); localStorage.setItem(PRESET_KEY,JSON.stringify(next,null,2)); setStatusWithTime(`Deleted preset: ${name}`); };
  const applyPreset=(name)=>{ captureSnapshot(`before preset ${name}`); loadPresetObject(name, stylePresets[name]); };

  const addHistory=(label,promptText=prompt,state=currentState)=>{
    const item={id:Date.now(),label,time:new Date().toLocaleTimeString(),prompt:promptText,state:slimStateForHistory(state),avgScore};
    const next=[item,...history].slice(0,12); setHistory(next); localStorage.setItem(HISTORY_KEY,JSON.stringify(next,null,2));
  };

  const copyPrompt=async()=>{ const ok = await copyToClipboard(prompt, "Prompt copied"); if(!ok) return; setCopied(true); addHistory("Copied prompt"); setTimeout(()=>setCopied(false),1200); };
  const restoreHistory=(item)=>{ loadState(item.state); setSelectedHistoryId(item.id); setStatusWithTime(`Restored: ${item.label}`); };
  const clearHistory=()=>{ setHistory([]); localStorage.removeItem(HISTORY_KEY); setStatusWithTime("History cleared"); };

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

        <div className="grid gap-4 lg:grid-cols-[300px_1fr_380px]">
          <aside className="space-y-4">
            <Panel title="Style Presets" hint="Load factory or custom styles.">
              <div className="space-y-2">{Object.keys(stylePresets).map(name=><button key={name} onClick={()=>applyPreset(name)} className="w-full rounded-2xl border border-white/10 bg-black/25 p-3 text-left text-sm font-bold hover:border-cyan-300/50 hover:bg-cyan-300/10">{name}</button>)}</div>
              <div className="mt-4 rounded-2xl border border-orange-400/20 bg-orange-400/10 p-3"><div className="mb-2 text-xs font-bold uppercase tracking-wider text-orange-200">Save Current As Preset</div><input value={presetName} onChange={(e)=>setPresetName(e.target.value)} placeholder="Preset name..." className="mb-2 w-full rounded-xl border border-white/10 bg-black/30 p-2 text-sm text-white outline-none"/><button onClick={saveCustomPreset} className="w-full rounded-xl bg-orange-300 px-3 py-2 text-sm font-bold text-black hover:bg-orange-200">Save As Preset</button></div>
              {Object.keys(customPresets).length>0 && <div className="mt-4 space-y-2"><div className="text-xs font-bold uppercase tracking-wider text-white/45">Custom Presets</div>{Object.entries(customPresets).map(([name,p])=><div key={name} className="rounded-2xl border border-white/10 bg-black/25 p-2"><button onClick={()=>loadPresetObject(name,p)} className="w-full text-left text-sm font-bold text-cyan-100">{name}</button><button onClick={()=>deleteCustomPreset(name)} className="mt-2 text-xs font-bold text-red-300 hover:text-red-200">Delete</button></div>)}</div>}
            </Panel>

            <Panel title="Save / Load" hint="Keeps unfinished work safe. Reset to Default clears all preselected genres, sounds, rules, and lyrics so you can build step by step from guided step 1."><div className="grid gap-2"><button onClick={saveProject} className="rounded-2xl bg-emerald-300 px-4 py-2 font-bold text-black hover:bg-emerald-200">Save Progress</button><button onClick={exportProject} className="rounded-2xl bg-cyan-300 px-4 py-2 font-bold text-black hover:bg-cyan-200">Export JSON</button><label className="cursor-pointer rounded-2xl bg-white px-4 py-2 text-center font-bold text-black hover:bg-cyan-100">Import JSON<input type="file" accept="application/json" onChange={importProject} className="hidden"/></label><button onClick={revertSnapshot} className="rounded-2xl border border-amber-400/40 bg-amber-500/15 px-4 py-2 font-bold text-amber-100 hover:bg-amber-500/25">Revert to last snapshot</button><button onClick={resetAll} className="rounded-2xl bg-red-400 px-4 py-2 font-bold text-black hover:bg-red-300" title="Clears all preselected style, prompts, analyzers, and history">Reset to Default</button></div></Panel>
            <Panel title="Mode" hint="Controls stability vs creativity."><div className="grid grid-cols-3 gap-2">{["Control","Hybrid","Chaos"].map(m=><Pill key={m} active={mode===m} onClick={()=>{ setMode(m); setStatusWithTime(`Mode: ${m}`, "info"); }}>{m}</Pill>)}</div></Panel>
            <Panel title="Pro Mode" hint="Advanced controls and stronger prompt shaping."><button onClick={()=>{ const next=!proMode; setProMode(next); setStatusWithTime(next?"Pro Mode enabled":"Pro Mode disabled","info"); }} className={"w-full rounded-2xl px-4 py-2 font-bold transition active:scale-[0.98] "+(proMode?"bg-purple-300 text-black":"bg-black/40 text-white border border-white/10")}>{proMode?"Pro Mode ON":"Pro Mode OFF"}</button>{proMode && <div className="mt-3 space-y-3"><Slider label="Prompt Intensity" value={promptIntensity} left="safe" right="experimental" setValue={setPromptIntensity}/><Slider label="Variations" value={variationCount} left="1" right="8" min={1} max={8} setValue={setVariationCount}/><div className="rounded-2xl border border-purple-300/20 bg-purple-300/10 p-3 text-xs text-purple-100">{intensityText}</div></div>}</Panel>
          </aside>

          <section className="space-y-4">
            <SunoGuidedPath
              promptEngine={promptEngine}
              onSelectSunoEngine={() => {
                setPromptEngine("Suno-like");
                setStatusWithTime("Switched to Suno-like engine", "info");
              }}
              input={sunoGuidedInput}
              copyToClipboard={copyToClipboard}
              setStatusWithTime={setStatusWithTime}
              vocal={vocal}
              instrumentalVocalFx={instrumentalVocalFx}
              setVocal={setVocal}
              setInstrumentalVocalFx={setInstrumentalVocalFx}
              customPresets={customPresets}
              guidedStep={guidedStep}
              setGuidedStep={setGuidedStep}
              onApplyFactoryPreset={(name) => {
                applyPreset(name);
                setGuidedStep(0);
                setStatusWithTime(`Loaded preset: ${name} — guided path reset to step 1`);
              }}
              onLoadCustomPreset={(name) => {
                loadPresetObject(name, customPresets[name]);
                setGuidedStep(0);
                setStatusWithTime(`Loaded custom preset: ${name} — guided path reset to step 1`);
              }}
            />
            <Panel title="Step 1 — Idea Input" hint="Describe what you want in plain language."><input value={idea} onChange={(e)=>setIdea(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-white outline-none focus:border-cyan-300"/></Panel>


            <Panel title="Lyric Style Generator" hint="Suno-only lyric prompt metadata. Every generated line uses [] so Suno reads it as prompt direction, not lyric text.">
              <div className="grid gap-3 md:grid-cols-2">
                <label>
                  <div className="mb-1 text-xs font-bold uppercase tracking-wider text-white/45">Lyric Theme</div>
                  <input
                    value={lyricTheme}
                    onChange={(e)=>setLyricTheme(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-white outline-none focus:border-orange-300"
                  />
                </label>

                <label>
                  <div className="mb-1 text-xs font-bold uppercase tracking-wider text-white/45">Lyric Structure</div>
                  <input
                    value={lyricStructure}
                    onChange={(e)=>setLyricStructure(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-white outline-none focus:border-orange-300"
                  />
                </label>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <label>
                  <div className="mb-1 text-xs font-bold uppercase tracking-wider text-white/45">Lyric Style</div>
                  <select value={lyricStyle} onChange={(e)=>setLyricStyle(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-white outline-none">
                    {lyricStyleOptions.map(x => <option key={x}>{x}</option>)}
                  </select>
                </label>

                <label>
                  <div className="mb-1 text-xs font-bold uppercase tracking-wider text-white/45">Language</div>
                  <select value={lyricLanguage} onChange={(e)=>setLyricLanguage(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-white outline-none">
                    {SUNO_LYRIC_LANGUAGE_GROUPS.map((group) => (
                      <optgroup key={group.label} label={group.label}>
                        {group.languages.map((lang) => (
                          <option key={lang.label} value={lang.label}>{lang.label}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>

                <label>
                  <div className="mb-1 text-xs font-bold uppercase tracking-wider text-white/45">Lyric Mode</div>
                  <select value={lyricMode} onChange={(e)=>setLyricMode(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-white outline-none">
                    {lyricModeOptions.map(x => <option key={x}>{x}</option>)}
                  </select>
                </label>

                <Slider label="Lyric Density" value={lyricDensity} left="minimal" right="dense" setValue={setLyricDensity}/>
              </div>

              <CoProducerLyricsBlock
                lyricStyle={lyricStyle}
                generatedLyrics={generatedLyrics}
                generatedLyricsStyle={generatedLyricsStyle}
                onLyricsChange={setGeneratedLyrics}
                onGenerate={generateExampleLyrics}
                onAnotherTake={shuffleExampleLyrics}
                generateBusy={lyricsGenerateBusy}
              />

              {generatedLyrics && (
                <button
                  type="button"
                  onClick={() => copyToClipboard(generatedLyrics, "Generated lyrics copied")}
                  className="mt-2 w-full rounded-2xl border border-orange-300/30 bg-black/30 px-4 py-2 text-sm font-bold text-orange-100 hover:bg-black/50"
                >
                  Copy Generated Lyrics
                </button>
              )}

              <pre className="mt-3 max-h-52 overflow-auto whitespace-pre-wrap rounded-2xl border border-orange-300/20 bg-black/50 p-4 text-xs leading-relaxed text-orange-50">
                {lyricPrompt}
              </pre>

              <button
                onClick={() => copyToClipboard(lyricPrompt, "Lyric style prompt copied")}
                className="mt-3 w-full rounded-2xl bg-orange-300 px-4 py-2 font-bold text-black hover:bg-orange-200"
              >
                Copy Lyric Style Prompt
              </button>
            </Panel>

            <Panel
              title="Suno Voice Style Generator"
              hint="Uses famous artists as stylistic references only (prompt direction — not impersonation or voice cloning). Included in Suno-like prompt when vocals are on."
            >
              <p className="mb-3 text-xs text-white/50">
                Enter a first and last name, pick a quick preset, then generate. Paste the compact line into Suno&apos;s Style field; use the lyric tag above your verses in Custom Mode if you want.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                <label>
                  <div className="mb-1 text-xs font-bold uppercase tracking-wider text-white/45">
                    First name
                  </div>
                  <input
                    value={voiceRefFirstName}
                    onChange={(e) => setVoiceRefFirstName(e.target.value)}
                    placeholder="e.g. Freddie"
                    className="w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-white outline-none focus:border-cyan-300"
                  />
                </label>
                <label>
                  <div className="mb-1 text-xs font-bold uppercase tracking-wider text-white/45">
                    Last name
                  </div>
                  <input
                    value={voiceRefLastName}
                    onChange={(e) => setVoiceRefLastName(e.target.value)}
                    placeholder="e.g. Mercury (optional)"
                    className="w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-white outline-none focus:border-cyan-300"
                  />
                </label>
              </div>
              <div className="mt-3">
                <div className="mb-2 text-xs font-bold uppercase tracking-wider text-white/45">
                  Quick presets
                </div>
                <div className="flex flex-wrap gap-2">
                  {FAMOUS_VOICE_PRESETS.map((p, presetIdx) => {
                    const label = formatPublicName(p.first, p.last);
                    return (
                      <Pill
                        key={`voice-preset-${presetIdx}-${p.first}-${p.last}`}
                        active={false}
                        onClick={() => {
                          setVoiceRefFirstName(p.first);
                          setVoiceRefLastName(p.last);
                          setStatusWithTime(`Preset: ${label}`);
                        }}
                      >
                        {label}
                      </Pill>
                    );
                  })}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={generateVoiceStyleFromNames}
                  className="rounded-2xl bg-cyan-300 px-4 py-2 text-sm font-bold text-black hover:bg-cyan-200"
                >
                  Generate voice style
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setVoiceRefFirstName("");
                    setVoiceRefLastName("");
                    setVoiceStyleLine("");
                    setStatusWithTime("Voice style cleared");
                  }}
                  className="rounded-2xl border border-white/15 bg-black/30 px-4 py-2 text-sm font-bold text-white hover:bg-white/10"
                >
                  Clear
                </button>
              </div>
              {vocal === "Instrumental" && (
                <div className="mt-3 rounded-2xl border border-amber-300/25 bg-amber-300/10 p-3 text-xs text-amber-100">
                  Instrumental mode: voice reference is not added to the Suno-like export. Switch vocal preset to hear a lead vocal in the prompt.
                </div>
              )}
              {voiceStyleLine ? (
                <>
                  <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap rounded-2xl border border-cyan-300/20 bg-black/50 p-4 text-xs leading-relaxed text-cyan-50">
                    {voiceStyleLine}
                  </pre>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(voiceStyleLine, "Full voice style copied")
                    }
                    className="mt-2 w-full rounded-2xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-sm font-bold text-cyan-100 hover:bg-cyan-300/20"
                  >
                    Copy full voice style (Suno-like block)
                  </button>
                </>
              ) : null}
              {voiceStyleCompact.style ? (
                <div className="mt-3 space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-white/45">
                    Compact (Style box)
                  </div>
                  <pre className="max-h-24 overflow-auto whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/40 p-3 text-[11px] text-white/80">
                    {voiceStyleCompact.style}
                  </pre>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(voiceStyleCompact.style, "Compact style copied")
                    }
                    className="w-full rounded-2xl bg-white px-4 py-2 text-sm font-bold text-black hover:bg-cyan-100"
                  >
                    Copy compact style line
                  </button>
                  <div className="text-xs font-bold uppercase tracking-wider text-white/45">
                    Lyric metatag (optional)
                  </div>
                  <pre className="max-h-20 overflow-auto whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/40 p-3 text-[11px] text-white/80">
                    {voiceStyleCompact.lyricTag}
                  </pre>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(
                        voiceStyleCompact.lyricTag,
                        "Lyric metatag copied",
                      )
                    }
                    className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/20"
                  >
                    Copy lyric metatag
                  </button>
                </div>
              ) : null}
            </Panel>

            <Panel title="Drag & Drop Analyzers" hint="Optional Polish-step tools — track report with waveform, LUFS/dBTP meter, studio WAV export (Streaming −14 LUFS), merge into Suno fields, Goal, and Notes. Image DNA uses compact AUDIO:/IMAGE: lines for the 1000-character Style cap.">
              <div
                className={`mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-2xl border px-3 py-2 font-mono text-[11px] leading-snug ${
                  sunoFieldSlices.style.length > SUNO_STYLE_CHAR_CAP
                    ? "border-red-400/45 bg-red-500/15 text-red-100"
                    : sunoFieldSlices.style.length > SUNO_STYLE_CHAR_WARN
                      ? "border-amber-400/40 bg-amber-500/10 text-amber-50"
                      : "border-emerald-400/30 bg-emerald-500/10 text-emerald-50"
                }`}
              >
                <span>
                  Style box: {sunoFieldSlices.style.length}/{SUNO_STYLE_CHAR_CAP}
                  {promptEngine !== "Suno-like" ? (
                    <span className="ml-1.5 font-sans text-[10px] font-normal text-white/40">
                      (same string as validator when you use Suno-like)
                    </span>
                  ) : null}
                </span>
                <span
                  className={
                    sunoFieldSlices.lyrics.length > SUNO_LYRICS_CHAR_TYPICAL_MAX
                      ? "text-red-200"
                      : sunoFieldSlices.lyrics.length > SUNO_LYRICS_CHAR_WARN
                        ? "text-amber-200"
                        : "text-white/55"
                  }
                >
                  Lyrics: {sunoFieldSlices.lyrics.length}/{SUNO_LYRICS_CHAR_TYPICAL_MAX}
                </span>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <DropBox
                  title="Drop Audio File"
                  hint={SUPPORTED_AUDIO_LABEL}
                  accept={SUPPORTED_AUDIO_ACCEPT}
                  onFile={analyzeAudioFile}
                >
                  {audioAnalysis ? (
                    <AudioTrackEditor
                      analysis={audioAnalysis}
                      audioUrl={audioPreviewUrl}
                      onChange={updateAudioAnalysis}
                      onApply={() => {
                        captureSnapshot("before audio merge");
                        applyAudioToSunoStyle();
                      }}
                      onClear={clearAudioAnalysis}
                      onAttachAudio={attachAudioFile}
                      onAddLyricsForTrack={addLyricsFromInstrumentalTrack}
                      loudness={audioLoudness}
                      loudnessBusy={audioLoudnessBusy}
                      onExportEnhanced={exportEnhancedAudio}
                      exportBusy={audioExportBusy}
                      exportProgress={audioExportProgress}
                    />
                  ) : null}
                </DropBox>
                <DropBox
                  title="Drop Image File"
                  hint={SUPPORTED_IMAGE_LABEL}
                  accept={SUPPORTED_IMAGE_ACCEPT}
                  onFile={analyzeImageFile}
                >
                  {imagePreview && (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element -- blob Object URLs from analyzer */}
                      <img src={imagePreview} alt="Image preview" className="mx-auto mt-3 max-h-40 rounded-2xl object-contain" />
                    </>
                  )}
                  {imageAnalysis ? (
                    <div className="mt-3 text-left">
                      <p className="mb-2 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-[10px] leading-relaxed text-amber-100/90">
                        {IMAGE_ANALYZER_DISCLAIMER}
                      </p>
                      <div className="rounded-2xl bg-black/30 p-3 text-xs text-white/70 whitespace-pre-wrap">{imageAnalysis.summary}</div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          captureSnapshot("before image merge");
                          applyImageToSunoStyle();
                        }}
                        className="mt-2 w-full rounded-2xl border border-fuchsia-400/40 bg-fuchsia-500/20 py-2 text-xs font-bold text-fuchsia-50 hover:bg-fuchsia-500/30"
                      >
                        Add image style to Suno (merge) → next step
                      </button>
                    </div>
                  ) : null}
                </DropBox>
              </div>
            </Panel>


            {sourcePrompt.trim() && (
              <Panel title="Extracted Source Prompt" hint="Copy only the prompt created from audio/image analysis.">
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-2xl border border-orange-300/20 bg-black/50 p-4 text-xs leading-relaxed text-orange-50">
                  {sourcePrompt}
                </pre>
                <button
                  onClick={() => copyToClipboard(sourcePrompt, "Extracted prompt copied")}
                  className="mt-3 w-full rounded-2xl bg-orange-300 px-4 py-2 font-bold text-black hover:bg-orange-200"
                >
                  Copy Extracted Prompt
                </button>
              </Panel>
            )}

            <Panel title="Step 2 — Mood Sliders" hint="Shape the feeling without typing."><div className="grid gap-3 md:grid-cols-3">{[
              ["Darkness","bright","dark","darkness"],["Energy","calm","extreme","energy"],["Aggression","soft","brutal","aggression"],["Emotion","cold","emotional","emotion"],["Complexity","minimal","complex","complexity"],["Space","dry","wide","space"]
            ].map(([label,left,right,key])=><Slider key={key} label={label} value={mood[key]} left={left} right={right} setValue={(v)=>setMood({...mood,[key]:v})}/>)}</div></Panel>

            <Panel title="Step 3 — Clickable Music Controls" hint={`Suno-aligned genres (${genreOptions.length}), instruments (${soundOptions.length}), and rhythms. Style Prompt Library adds ${SUNO_GENRE_WHEEL_COUNT}+ fusion phrases from the Suno v5.5 genre wheel.`}>
              <SearchablePillGrid
                label="Genres"
                hint="Strong Suno genres by family — use Style Prompt Library below for fusion / wheel phrases."
                options={genreOptions}
                groups={SUNO_GENRE_GROUPS}
                selected={selectedGenres}
                onToggle={(x) => toggle(x, selectedGenres, setSelectedGenres)}
              />
              <StylePromptPicker
                selectedGenres={selectedGenres}
                setSelectedGenres={setSelectedGenres}
                rules={rules}
                setRules={setRules}
                setStatusWithTime={setStatusWithTime}
                defaultOpen
              />
              <SearchablePillGrid
                label="Rhythm"
                options={rhythmOptions}
                groups={SUNO_RHYTHM_GROUPS}
                selected={selectedRhythms}
                onToggle={(x) => toggle(x, selectedRhythms, setSelectedRhythms)}
              />
              <SearchablePillGrid
                label="Instruments & textures"
                hint="Core Suno instrument tags plus catalog lines — search e.g. sax, 808, koto."
                options={soundOptions}
                groups={SUNO_INSTRUMENT_GROUPS}
                selected={selectedSounds}
                onToggle={(x) => toggle(x, selectedSounds, setSelectedSounds)}
              />
              <div><div className="mb-2 text-xs font-bold uppercase tracking-wider text-white/45">Vocals</div><div className="flex flex-wrap gap-2">{vocalOptions.map(x=><Pill key={x} active={vocal===x} onClick={()=>setVocal(x)}>{x}</Pill>)}</div></div>
            </Panel>

            <Panel title="Step 4 — Co‑Producer Buttons" hint="One-click creative direction."><div className="flex flex-wrap gap-2">{["Make darker","More aggressive","More minimal","More cinematic","More club"].map(x=><button key={x} onClick={()=>coProducer(x)} className="rounded-2xl bg-white px-4 py-2 text-sm font-bold text-black hover:bg-cyan-100">{x}</button>)}</div></Panel>

            <Panel title="Co‑Producer AI" hint="Improve Prompt analyzes balance and gaps; quick fixes append rule lines. Hooks and lyrics follow your Lyric Style.">
              <p className="mb-3 text-[11px] leading-relaxed text-white/50">
                <strong className="text-white/65">Copy guide:</strong> Lyric Style Generator = bracketed Suno direction only.
                <strong className="text-white/65"> Generate Lyrics</strong> writes draft lyric text matched to{" "}
                <strong className="text-white/65">{lyricStyle}</strong> ({getLyricStyleDirection(lyricStyle)}).
                Raw Prompt = bracketed direction; Structured Song / Performance Ready = [Verse]/[Chorus] drafts.
              </p>
              <div className="grid gap-2 md:grid-cols-3">
                <button onClick={buildCoProducerAI} className="rounded-2xl bg-emerald-300 px-4 py-2 font-bold text-black hover:bg-emerald-200">
                  Improve Prompt
                </button>
                <button onClick={() => generateHooks()} className="rounded-2xl bg-cyan-300 px-4 py-2 font-bold text-black hover:bg-cyan-200">
                  Generate Hooks
                </button>
                <button onClick={() => generateHooks(true)} className="rounded-2xl border border-cyan-300/40 bg-black/30 px-4 py-2 font-bold text-cyan-100 hover:bg-black/50">
                  Another hook take
                </button>
              </div>

              <div className="mt-3">
                <div className="mb-2 text-xs font-bold uppercase tracking-wider text-white/45">Quick rule fixes</div>
                <div className="flex flex-wrap gap-2">
                  {Object.keys(fixes).map((label) => (
                    <button
                      key={label}
                      type="button"
                      title={fixes[label]}
                      onClick={() => applyQuickFix(label)}
                      className="rounded-2xl border border-amber-300/30 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-100 hover:bg-amber-500/20"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <CoProducerLlmSettings
                settings={coProducerLlmSettings}
                onChange={setCoProducerLlmSettings}
                onSave={() => {
                  saveCoProducerLlmSettings(coProducerLlmSettings);
                  setStatusWithTime("LLM settings saved locally");
                }}
              />

              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <label>
                  <div className="mb-1 text-xs font-bold uppercase tracking-wider text-white/45">Prompt Format</div>
                  <select value={promptFormat} onChange={(e)=>setPromptFormat(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-white outline-none">
                    {promptFormatOptions.map(x => <option key={x}>{x}</option>)}
                  </select>
                </label>
                <label>
                  <div className="mb-1 text-xs font-bold uppercase tracking-wider text-white/45">Prompt Engine</div>
                  <select value={promptEngine} onChange={(e)=>setPromptEngine(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-white outline-none">
                    <option>Standard</option>
                    <option>Suno-like</option>
                  </select>
                </label>
              </div>

              {coProducerOutput && (
                <pre className="mt-3 max-h-52 overflow-auto whitespace-pre-wrap rounded-2xl border border-emerald-300/20 bg-black/50 p-4 text-xs leading-relaxed text-emerald-50">
                  {coProducerOutput}
                </pre>
              )}

              <CoProducerHooksBlock
                lyricStyle={lyricStyle}
                generatedHooks={generatedHooks}
                generatedHooksStyle={generatedHooksStyle}
              />

              <CoProducerLyricsBlock
                className="mt-3"
                lyricStyle={lyricStyle}
                generatedLyrics={generatedLyrics}
                generatedLyricsStyle={generatedLyricsStyle}
                onLyricsChange={setGeneratedLyrics}
                onGenerate={generateExampleLyrics}
                onAnotherTake={shuffleExampleLyrics}
                generateBusy={lyricsGenerateBusy}
                showStyleHint={false}
              />

              <div className="mt-3 grid gap-2 md:grid-cols-3">
                <button onClick={() => copyToClipboard(coProducerOutput || "", "Report copied")} className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/20">Copy Report</button>
                <button onClick={() => copyToClipboard(generatedHooks || "", "Hooks copied")} className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/20">Copy Hooks</button>
                <button onClick={() => copyToClipboard(generatedLyrics || "", "Lyrics copied")} className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/20">Copy Lyrics</button>
              </div>
            </Panel>

            <Panel title="Variation Engine" hint="Auto-generate prompt versions while keeping your core identity."><button onClick={generateVariations} className="w-full rounded-2xl bg-fuchsia-300 px-4 py-2 font-bold text-black hover:bg-fuchsia-200">Generate {variationCount} Variations</button>{variations.length>0 && <><VariationCompare key={variations.map((v) => v.id).join("-")} variations={variations} onCopy={copyToClipboard} onApplyWinner={(text)=>{ setNotes(text.slice(0,2000)); setStatusWithTime("Variation A seeded into Notes"); }} /><div className="mt-3 space-y-3">{variations.map(v=><div key={v.id} className="rounded-2xl border border-white/10 bg-black/30 p-3"><div className="mb-2 font-bold text-fuchsia-200">{v.title}</div><pre className="max-h-48 overflow-auto whitespace-pre-wrap text-xs text-white/70">{v.prompt}</pre><button onClick={()=>copyToClipboard(v.prompt, `${v.title} copied`)} className="mt-2 rounded-xl bg-white px-3 py-1 text-xs font-bold text-black hover:bg-cyan-100">Copy Variation</button></div>)}</div></>}</Panel>

            {proMode && <Panel title="Advanced Override" hint="Optional text editing for exact control."><div className="grid gap-3 md:grid-cols-2"><label><div className="mb-1 text-xs font-bold uppercase tracking-wider text-white/45">Tempo</div><input value={tempo} onChange={(e)=>setTempo(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-white outline-none"/></label><label><div className="mb-1 text-xs font-bold uppercase tracking-wider text-white/45">Structure</div><input value={structure} onChange={(e)=>setStructure(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-white outline-none"/></label></div><div className="mt-3 grid gap-3 md:grid-cols-2"><TextBox label="Rules" value={rules} setValue={setRules}/><TextBox label="Notes / Analyzer Output" value={notes} setValue={setNotes}/></div></Panel>}
          </section>

          <aside className="space-y-4">
            <Panel title="Prompt Preview" hint="Copy this into Suno or another AI music tool."><pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-2xl border border-cyan-300/20 bg-black/50 p-4 text-xs leading-relaxed text-cyan-50">{prompt}</pre><div className="mt-3 grid grid-cols-2 gap-2"><button onClick={copyPrompt} className="rounded-2xl bg-cyan-300 px-4 py-2 font-bold text-black hover:bg-cyan-200">{copied?"Copied!":"Copy Prompt"}</button><button onClick={()=>addHistory("Manual snapshot")} className="rounded-2xl bg-white px-4 py-2 font-bold text-black hover:bg-cyan-100">Save Snapshot</button></div>{promptEngine === "Suno-like" && sunoSlices ? (<div className="mt-2 grid grid-cols-2 gap-2"><button type="button" onClick={()=>copyToClipboard(sunoSlices.style,"Suno Style box copied")} className="rounded-2xl border border-cyan-400/35 bg-cyan-500/15 px-4 py-2 text-xs font-bold text-cyan-100 hover:bg-cyan-500/25">Copy Style box</button><button type="button" onClick={()=>copyToClipboard(sunoSlices.lyrics,"Suno Lyrics field copied")} className="rounded-2xl border border-fuchsia-400/35 bg-fuchsia-500/15 px-4 py-2 text-xs font-bold text-fuchsia-100 hover:bg-fuchsia-500/25">Copy Lyrics field</button></div>) : null}</Panel>
            {promptEngine === "Suno-like" && (
              <Panel title="Suno-like Validator" hint="Checks structured style/prompt constraints before copying.">
                {sunoSlices ? (
                  <div className="mb-3 rounded-2xl border border-white/10 bg-black/35 p-3 text-[10px] leading-relaxed text-white/55">
                    <div className="font-bold text-cyan-100/90">Suno field lengths (paste-ready)</div>
                    <div className="mt-1 font-mono text-white/75">
                      Style: {sunoSlices.style.length} / {SUNO_STYLE_CHAR_CAP} (cap) · Lyrics: {sunoSlices.lyrics.length} / ~
                      {SUNO_LYRICS_CHAR_TYPICAL_MAX}
                    </div>
                    <p className="mt-2 text-white/45">{SUNO_LIMITS_NOTE}</p>
                  </div>
                ) : null}
                {sunoWarnings.length > 0 && (
                  <button
                    onClick={fixSunoWarnings}
                    className="mb-3 w-full rounded-2xl bg-emerald-300 px-4 py-2 text-sm font-bold text-black hover:bg-emerald-200"
                  >
                    Fix Suno Warnings
                  </button>
                )}
                {sunoWarnings.length ? (
                  <div className="space-y-2">
                    {sunoWarnings.map((w, i) => (
                      <div key={i} className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-3 text-xs text-amber-50">
                        {w}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-3 text-xs text-emerald-100">
                    Prompt structure looks solid for Suno-like generation.
                  </div>
                )}
              </Panel>
            )}
                        <SunoLanguageIndexPanel copyToClipboard={copyToClipboard} onApplyGenreAnchors={applyGenreAnchors} />
<Panel title="History / Compare" hint="Restore earlier prompt states."><button onClick={clearHistory} className="mb-3 w-full rounded-2xl border border-red-300/30 bg-red-300/10 px-4 py-2 text-sm font-bold text-red-200 hover:bg-red-300/20">Clear History</button>{history.length===0?<div className="rounded-2xl border border-white/10 bg-black/25 p-3 text-xs text-white/45">No history yet. Copy a prompt, save a snapshot, or generate variations.</div>:<div className="space-y-2">{history.map(h=><div key={h.id} className={"rounded-2xl border p-3 "+(selectedHistoryId===h.id?"border-cyan-300/50 bg-cyan-300/10":"border-white/10 bg-black/25")}><div className="flex items-center justify-between gap-2"><div><div className="text-sm font-bold text-cyan-100">{h.label}</div><div className="text-[10px] text-white/40">{h.time} • score {h.avgScore}/5</div></div><button onClick={()=>restoreHistory(h)} className="rounded-xl bg-white px-2 py-1 text-xs font-bold text-black">Restore</button></div><pre className="mt-2 max-h-20 overflow-auto whitespace-pre-wrap text-[10px] text-white/45">{h.prompt}</pre></div>)}</div>}</Panel>
            <Panel title="Track Scoring" hint="Use after generation to compare outputs.">{Object.entries(scores).map(([key,value])=><div key={key} className="mb-3 rounded-2xl bg-black/25 p-3"><div className="mb-2 flex justify-between text-sm"><span className="capitalize text-white/70">{key}</span><span className="font-bold text-cyan-200">{value}/5</span></div><input type="range" min="1" max="5" value={value} onChange={(e)=>setScores({...scores,[key]:Number(e.target.value)})} className="w-full accent-cyan-300"/></div>)}</Panel>
          </aside>
        </div>
      </div>
      <div className="fixed bottom-3 left-6 z-50 rounded-full border border-orange-400/30 bg-black/50 px-3 py-1 text-xs font-bold text-orange-300 backdrop-blur">Version {APP_VERSION}</div>
      <div className="fixed bottom-3 right-6 z-50 rounded-full border border-white/10 bg-black/50 px-3 py-1 text-xs text-white/60 backdrop-blur">Created by <span className="font-bold text-orange-300">{AUTHOR}</span></div>
    </main>
  );
}
