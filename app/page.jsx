"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppHeader, SplashOverlay } from "./components/app-shell";
import { SunoGuidedPath } from "./components/suno-guided-path";
import { StylePromptPicker } from "./components/suno-english-style-prompt-picker";
import { AudioTrackEditor } from "./components/audio-track-editor";
import { DropBox, Panel, Pill, Slider, TextBox } from "./components/ui-blocks";
import { useAnalyzers } from "./hooks/use-analyzers";
import { useClipboard } from "./hooks/use-clipboard";
import { useSplashOverlay } from "./hooks/use-splash-seen";
import { useStatusMessage } from "./hooks/use-status-message";
import {
  buildSunoLikePrompt,
  buildSunoLyricsBoxPrompt,
  buildSunoStyleBoxPrompt,
  validateSunoLikePrompt,
} from "./lib/suno-rules";
import {
  SUNO_LIMITS_NOTE,
  SUNO_LYRICS_CHAR_TYPICAL_MAX,
  SUNO_STYLE_CHAR_CAP,
  SUNO_STYLE_CHAR_WARN,
} from "./lib/suno-limits";
import {
  SUPPORTED_AUDIO_ACCEPT,
  SUPPORTED_AUDIO_LABEL,
  SUPPORTED_IMAGE_ACCEPT,
  SUPPORTED_IMAGE_LABEL,
} from "./lib/analyzer-file-types";
import {
  collectGenreAnchors,
  formatPromptSymbolGuidePlain,
  formatVocalArtifactGuidePlain,
  referencePromptBlocks,
  stylePromptCatalog,
  sunoLanguageIndex,
} from "./lib/suno-language-index";
import {
  APP_VERSION,
  AUTHOR,
  DEFAULT_STATE,
  fixes,
  genreOptions,
  HISTORY_KEY,
  lyricLanguageOptions,
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
import {
  bracketizeSunoPromptBlock,
  bracketizeSunoPromptLine,
  buildLyricPrompt,
  getIntensityText,
  getVocalText,
  uniq,
} from "./lib/music-helpers";
import {
  buildSunoVoiceStyleCompact,
  buildSunoVoiceStyleLine,
  FAMOUS_VOICE_PRESETS,
  formatPublicName,
} from "./lib/suno-voice-style";

function flattenStylePromptCatalog(cat) {
  return Object.entries(cat)
    .map(([section, lines]) => `## ${section.replace(/([A-Z])/g, " $1").trim()}\n${lines.join("\n")}`)
    .join("\n\n");
}

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
  const { statusMessage: saveStatus, setStatusWithTime } = useStatusMessage("Not saved yet");
  const [issue,setIssue]=useState("Weak bass");
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
  const [generatedHooks, setGeneratedHooks] = useState(DEFAULT_STATE.generatedHooks);
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
    audioPreviewUrl,
    canvasRef,
    clearAudioAnalysis,
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
      generatedHooks,
      lyricMode,
      voiceRefFirstName,
      voiceRefLastName,
      voiceStyleLine,
      instrumentalVocalFx,
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
      generatedHooks,
      lyricMode,
      voiceRefFirstName,
      voiceRefLastName,
      voiceStyleLine,
      instrumentalVocalFx,
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
    if(data.audioAnalysis) setAudioAnalysis(data.audioAnalysis);
    if(data.imageAnalysis) setImageAnalysis(data.imageAnalysis);
    setLyricTheme(data.lyricTheme ?? DEFAULT_STATE.lyricTheme);
    setLyricLanguage(data.lyricLanguage ?? DEFAULT_STATE.lyricLanguage);
    setLyricStructure(data.lyricStructure ?? DEFAULT_STATE.lyricStructure);
    setLyricStyle(data.lyricStyle ?? DEFAULT_STATE.lyricStyle);
    setLyricDensity(data.lyricDensity ?? DEFAULT_STATE.lyricDensity);
    setPromptFormat(data.promptFormat ?? DEFAULT_STATE.promptFormat);
    setPromptEngine(data.promptEngine ?? DEFAULT_STATE.promptEngine ?? "Standard");
    setCoProducerOutput(data.coProducerOutput ?? DEFAULT_STATE.coProducerOutput);
    setGeneratedLyrics(data.generatedLyrics ?? DEFAULT_STATE.generatedLyrics);
    setGeneratedHooks(data.generatedHooks ?? DEFAULT_STATE.generatedHooks);
    setLyricMode(data.lyricMode ?? DEFAULT_STATE.lyricMode);
    setVoiceRefFirstName(data.voiceRefFirstName ?? DEFAULT_STATE.voiceRefFirstName ?? "");
    setVoiceRefLastName(data.voiceRefLastName ?? DEFAULT_STATE.voiceRefLastName ?? "");
    setVoiceStyleLine(data.voiceStyleLine ?? DEFAULT_STATE.voiceStyleLine ?? "");
    setInstrumentalVocalFx(data.instrumentalVocalFx ?? DEFAULT_STATE.instrumentalVocalFx);
  }, [setAudioAnalysis, setImageAnalysis]);

  const resetAll=()=>{
    loadState(DEFAULT_STATE);
    setVariations([]);
    resetAnalyzers();
    setGuidedStep(0);
    localStorage.removeItem(STORAGE_KEY);
    resetSplash();
    setStatusWithTime("Reset to default");
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
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(PRESET_KEY);
            localStorage.removeItem(HISTORY_KEY);
            setCustomPresets({});
            setHistory([]);
            setVariations([]);
            resetAnalyzers();
            setGuidedStep(0);
            lastAutosavePayloadRef.current = "";
            setStatusWithTime(`Reset styles and prompts for v${APP_VERSION}`);
            return;
          }
          loadState(parsed);
          setStatusWithTime("Loaded saved project");
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
        const payload = JSON.stringify(currentState);
        if (payload === lastAutosavePayloadRef.current) return;
        localStorage.setItem(STORAGE_KEY, payload);
        lastAutosavePayloadRef.current = payload;
        setStatusWithTime("Autosaved");
      } catch {
        setStatusWithTime("Autosave failed");
      }
    }, 600);
    return () => window.clearTimeout(timeoutId);
  }, [currentState, setStatusWithTime]);

  useEffect(() => {
    if (promptEngine === "Suno-like") return;
    const t = window.setTimeout(() => {
      setGuidedStep(0);
    }, 0);
    return () => window.clearTimeout(t);
  }, [promptEngine]);

  const toggle=(item,list,setter)=>setter(list.includes(item)?list.filter(x=>x!==item):[...list,item]);

  const moodWords=useMemo(()=>{
    const out=[];
    if(mood.darkness>65) out.push("dark"); if(mood.darkness<35) out.push("bright");
    if(mood.energy>70) out.push("high-energy"); if(mood.energy<35) out.push("calm");
    if(mood.aggression>65) out.push("aggressive"); if(mood.emotion>60) out.push("emotional");
    if(mood.complexity>65) out.push("complex"); if(mood.complexity<35) out.push("minimal");
    if(mood.space>65) out.push("wide and spacious");
    if(!out.length) out.push("balanced");
    return out.join(", ");
  },[mood]);

  const intensityText=useMemo(()=>getIntensityText(promptIntensity),[promptIntensity]);

  const vocalText = useMemo(() => {
    if (vocal === "Instrumental" && instrumentalVocalFx) {
      return "instrumental arrangement with vocal FX only (short chops, textures, one-shots — no sung lyrics or verses)";
    }
    return getVocalText(vocal);
  }, [vocal, instrumentalVocalFx]);


  const lyricPrompt = useMemo(() => {
    return buildLyricPrompt({
      vocal,
      lyricDensity,
      lyricLanguage,
      lyricTheme,
      lyricStyle,
      lyricMode,
      lyricStructure,
      selectedGenres,
      moodWords,
    });
  }, [vocal, lyricDensity, lyricLanguage, lyricTheme, lyricStyle, lyricMode, lyricStructure, selectedGenres, moodWords]);

  const compressedPrompt = useMemo(() => {
    return `${selectedGenres.join(" + ") || "Electronic"} | ${tempo} | ${moodWords}
Sound: ${selectedSounds.slice(0, 6).join(", ") || "balanced instruments"}
Rhythm: ${selectedRhythms.join(", ") || "steady groove"}
Vocals: ${vocalText}
Goal: ${idea}
Lyrics: ${vocal === "Instrumental" ? "instrumental only" : `${lyricStyle}, ${lyricTheme}`}
Rules: ${rules}`;
  }, [selectedGenres, tempo, moodWords, selectedSounds, selectedRhythms, vocalText, idea, vocal, lyricStyle, lyricTheme, rules]);

  const detailedPrompt = useMemo(() => {
    return `STYLE:
${selectedGenres.join(" + ") || "Electronic"} | ${tempo} | ${moodWords}

SOUND:
${selectedSounds.join(", ") || "balanced instruments"} | Rhythm: ${selectedRhythms.join(", ") || "steady groove"}

VOCALS:
${vocalText}

SONG MAP:
${structure}

GOAL:
${idea}

${vocal !== "Instrumental" ? lyricPrompt : "LYRICS:\nInstrumental only."}

RULES:
${rules}
Intensity: ${intensityText}
Mode: ${mode}

${audioAnalysis ? `AUDIO DNA:\n${audioAnalysis.summary}` : ""}

${imageAnalysis ? `IMAGE DNA:\n${imageAnalysis.summary}` : ""}

CO-PRODUCER:
${coProducerOutput || "No co-producer notes yet."}

NOTES:
${notes || "No extra notes."}`;
  }, [selectedGenres, tempo, moodWords, selectedSounds, selectedRhythms, vocalText, structure, idea, vocal, lyricPrompt, rules, intensityText, mode, audioAnalysis, imageAnalysis, coProducerOutput, notes]);

  const prompt = useMemo(() => {
    if (promptEngine === "Suno-like") {
      return buildSunoLikePrompt({
        selectedGenres,
        tempo,
        moodWords,
        selectedSounds,
        selectedRhythms,
        vocalText,
        structure,
        idea,
        lyricPrompt,
        vocal,
        rules,
        intensityText,
        mode,
        voiceStyleReference: voiceStyleLine,
      });
    }

    if (promptFormat === "Compressed") return compressedPrompt;
    if (promptFormat === "Detailed") return detailedPrompt;

    return `STYLE:
${selectedGenres.join(" + ") || "Electronic"} | ${tempo} | ${moodWords}

SOUND:
${selectedSounds.slice(0, 8).join(", ") || "balanced instruments"}
Rhythm: ${selectedRhythms.join(", ") || "steady groove"}

VOCALS:
${vocalText}

GOAL:
${idea}

${vocal !== "Instrumental" ? lyricPrompt : "LYRICS:\nInstrumental only."}

RULES:
${rules}
Intensity: ${intensityText} | Mode: ${mode}

${coProducerOutput ? `CO-PRODUCER:\n${coProducerOutput}` : ""}`;
  }, [promptEngine, promptFormat, compressedPrompt, detailedPrompt, selectedGenres, tempo, moodWords, selectedSounds, selectedRhythms, vocalText, structure, idea, vocal, lyricPrompt, rules, intensityText, mode, coProducerOutput, voiceStyleLine]);

  /** Same strings as Suno validator / copy buttons — computed once per state change. */
  const sunoFieldSlices = useMemo(() => {
    const p = {
      selectedGenres,
      tempo,
      moodWords,
      selectedSounds,
      selectedRhythms,
      vocalText,
      structure,
      idea,
      vocal,
      rules,
      intensityText,
      mode,
      voiceStyleReference: voiceStyleLine,
    };
    return {
      style: buildSunoStyleBoxPrompt(p),
      lyrics: buildSunoLyricsBoxPrompt({ vocal, lyricPrompt }),
    };
  }, [
    selectedGenres,
    tempo,
    moodWords,
    selectedSounds,
    selectedRhythms,
    vocalText,
    structure,
    idea,
    vocal,
    rules,
    intensityText,
    mode,
    voiceStyleLine,
    lyricPrompt,
  ]);

  const sunoSlices = useMemo(
    () => (promptEngine !== "Suno-like" ? null : sunoFieldSlices),
    [promptEngine, sunoFieldSlices],
  );

  const sunoWarnings = useMemo(
    () =>
      validateSunoLikePrompt({
        selectedGenres,
        selectedSounds,
        selectedRhythms,
        vocal,
        instrumentalVocalFx,
        rules,
        structure,
        idea,
        tempo,
        moodWords,
        vocalText,
        lyricPrompt,
        intensityText,
        mode,
        voiceStyleReference: voiceStyleLine,
      }),
    [
      selectedGenres,
      selectedSounds,
      selectedRhythms,
      vocal,
      instrumentalVocalFx,
      rules,
      structure,
      idea,
      tempo,
      moodWords,
      vocalText,
      lyricPrompt,
      intensityText,
      mode,
      voiceStyleLine,
    ],
  );

  const sunoGuidedInput = useMemo(
    () => ({
      selectedGenres,
      tempo,
      moodWords,
      selectedSounds,
      selectedRhythms,
      vocal,
      instrumentalVocalFx,
      idea,
      structure,
      rules,
      mode,
      voiceStyleLine,
      lyricPrompt,
    }),
    [
      selectedGenres,
      tempo,
      moodWords,
      selectedSounds,
      selectedRhythms,
      vocal,
      instrumentalVocalFx,
      idea,
      structure,
      rules,
      mode,
      voiceStyleLine,
      lyricPrompt,
    ],
  );

  const voiceStyleCompact = useMemo(
    () =>
      buildSunoVoiceStyleCompact({
        firstName: voiceRefFirstName,
        lastName: voiceRefLastName,
        selectedGenres,
      }),
    [voiceRefFirstName, voiceRefLastName, selectedGenres],
  );

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
    if (!selectedGenres.length) setSelectedGenres(["Techno"]);
    if (!selectedSounds.length) setSelectedSounds(["Heavy sub bass", "Analog synths"]);
    if (!selectedRhythms.length) setSelectedRhythms(["4/4"]);
    if (!structure || structure.trim().length < 8) {
      setStructure("intro → verse → pre-chorus → chorus → bridge → final chorus → outro");
    }
    if (!idea || idea.trim().length < 10) {
      setIdea("high-impact track with clear identity, strong groove, and memorable emotional arc");
    }
    if (
      vocal === "Instrumental" &&
      !instrumentalVocalFx &&
      !rules.toLowerCase().includes("no vocal")
    ) {
      setRules((prev) => `${prev}${prev.trim() ? "\n" : ""}no vocals, no vocal chops, no mumbled speech`);
    }
    if (selectedGenres.length > 2) {
      setSelectedGenres(selectedGenres.slice(0, 2));
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


  const sourcePrompt = useMemo(() => {
    const parts = [];

    if (audioAnalysis) {
      parts.push(`AUDIO STYLE PROMPT:
Use this audio analysis as the musical DNA.

${audioAnalysis.summary}

Music direction:
- Match the detected energy, aggression, brightness, and rhythmic behavior.
- Translate the audio character into genre, groove, bass design, drum feel, and production texture.
- Keep the result usable as a music-generation prompt.`);
    }

    if (imageAnalysis) {
      parts.push(`IMAGE STYLE PROMPT:
Convert this image analysis into a music style.

${imageAnalysis.summary}

Music direction:
- Translate color, contrast, brightness, and visual mood into sound.
- Use the image as emotional and atmospheric direction.
- Turn visual texture into instruments, rhythm, space, and mix character.`);
    }

    return parts.join("\n\n---\n\n");
  }, [audioAnalysis, imageAnalysis]);

  const avgScore=((scores.bass+scores.rhythm+scores.identity+scores.clarity)/4).toFixed(1);

  const { copyToClipboard } = useClipboard(setStatusWithTime);

  const saveProject=()=>{ 
    const payload = JSON.stringify(currentState, null, 2);
    localStorage.setItem(STORAGE_KEY, payload);
    lastAutosavePayloadRef.current = JSON.stringify(currentState);
    setStatusWithTime("Saved"); 
  };
  const exportProject=()=>{ const blob=new Blob([JSON.stringify(currentState,null,2)],{type:"application/json"}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download="ai-music-project.json"; a.click(); URL.revokeObjectURL(url); };
  const importProject=(event)=>{ const file=event.target.files?.[0]; if(!file) return; const reader=new FileReader(); reader.onload=()=>{ try{ loadState(JSON.parse(String(reader.result))); setStatusWithTime("Imported JSON project"); }catch{ setStatusWithTime("Import failed"); } }; reader.readAsText(file); };

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
  const applyPreset=(name)=>loadPresetObject(name, stylePresets[name]);

  const addHistory=(label,promptText=prompt,state=currentState)=>{
    const item={id:Date.now(),label,time:new Date().toLocaleTimeString(),prompt:promptText,state,avgScore};
    const next=[item,...history].slice(0,12); setHistory(next); localStorage.setItem(HISTORY_KEY,JSON.stringify(next,null,2));
  };

  const copyPrompt=async()=>{ const ok = await copyToClipboard(prompt, "Prompt copied"); if(!ok) return; setCopied(true); addHistory("Copied prompt"); setTimeout(()=>setCopied(false),1200); };
  const restoreHistory=(item)=>{ loadState(item.state); setSelectedHistoryId(item.id); setStatusWithTime(`Restored: ${item.label}`); };
  const clearHistory=()=>{ setHistory([]); localStorage.removeItem(HISTORY_KEY); setStatusWithTime("History cleared"); };

  const applyFix=()=>{ setRules(old=>`${old}\n${fixes[issue]}`); setStatusWithTime(`Applied fix: ${issue}`); };

  const coProducer=(action)=>{
    if(action==="Make darker") setMood(m=>({...m,darkness:Math.min(100,m.darkness+15)}));
    if(action==="More aggressive") setMood(m=>({...m,aggression:Math.min(100,m.aggression+15),energy:Math.min(100,m.energy+10)}));
    if(action==="More minimal") setMood(m=>({...m,complexity:Math.max(0,m.complexity-20)}));
    if(action==="More cinematic"){ setSelectedGenres(g=>uniq([...g,"Cinematic"])); setSelectedSounds(s=>uniq([...s,"Orchestral strings","Big drums"])); setMood(m=>({...m,space:Math.min(100,m.space+15),emotion:Math.min(100,m.emotion+10)})); }
    if(action==="More club"){ setSelectedRhythms(r=>uniq([...r,"4/4"])); setSelectedSounds(s=>uniq([...s,"Heavy sub bass","Big drums"])); setMood(m=>({...m,energy:Math.min(100,m.energy+15)})); }
    setStatusWithTime(action);
  };

  const analyze=()=>{
    const messages=[];
    if(!selectedGenres.length) messages.push("Add at least one genre.");
    if(!selectedRhythms.length) messages.push("Add rhythm behavior.");
    if(!selectedSounds.length) messages.push("Add sound modules.");
    if(vocal!=="Instrumental" && !rules.toLowerCase().includes("vocal")) messages.push("Add vocal-control rules to prevent drift.");
    if(idea.length<10) messages.push("Describe the creative goal in more detail.");
    if(promptIntensity>75 && mode==="Control") messages.push("High prompt intensity conflicts with Control mode. Use Hybrid or Chaos.");
    if(!messages.length) messages.push("Prompt looks complete. Generate variations, score them, then refine the weakest area.");
    setNotes(messages.join("\n"));
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

  const generateHooks = () => {
    if (vocal === "Instrumental") {
      setGeneratedHooks(
        bracketizeSunoPromptLine(
          "Instrumental mode is active. Switch vocal mode to generate lyric hooks.",
        ),
      );
      setStatusWithTime("Hooks skipped in instrumental mode");
      return;
    }
    const core = lyricTheme || idea;
    const energyWord = mood.energy > 70 ? "ignite" : "breathe";
    const darkWord = mood.darkness > 65 ? "night" : "light";
    const hooks = `${bracketizeSunoPromptLine("HOOK IDEAS")}
${bracketizeSunoPromptLine("Meta: Example hook sketches below — singable lines for the Lyrics field, not Style metadata.")}

1.
${core}
Feel the bass in the ${darkWord}
We don't stop, we ${energyWord}

2.
Under pressure, under sound
We rise where the lights go down

3.
Move like thunder, breathe like fire
One more drop takes us higher`;

    setGeneratedHooks(hooks);
    setStatusWithTime("Generated hook ideas");
  };

  const generateExampleLyrics = () => {
    if (vocal === "Instrumental") {
      setGeneratedLyrics(
        bracketizeSunoPromptLine(
          "Instrumental mode is active. Switch vocal mode to generate lyrics.",
        ),
      );
      return;
    }

    const hookLine = mood.darkness > 65
      ? "In the dark we come alive"
      : "In the light we rise again";

    const energyLine = mood.energy > 70
      ? "Feel the pressure, feel the sound"
      : "Slow motion, drifting down";

    const styleLine =
      lyricStyle === "Robotic cyber" ? "Metal heart, electric mind" :
      lyricStyle === "Club chant" ? "Hands up, bass down, move now" :
      lyricStyle === "Aggressive hype" ? "Break the floor, shake the walls" :
      lyricStyle === "Minimal mantra" ? "One pulse, one breath, one flame" :
      lyricStyle === "Dreamlike abstract" ? "Silver shadows melt in rain" :
      "Shadows move under my skin";

    let lyrics = "";

    if (lyricMode === "Raw Prompt") {
      lyrics = bracketizeSunoPromptBlock(`LYRIC DIRECTION
Language: ${lyricLanguage}
Theme: ${lyricTheme}
Style: ${lyricStyle}
Mood: ${moodWords}
Write short, singable lines with a strong repeated hook.
Use [Verse], [Chorus], [Bridge], and [Outro] tags.`);
    } else if (lyricMode === "Performance Ready") {
      lyrics = `[Intro]
(${mood.darkness > 65 ? "dark atmosphere, distant vocal texture" : "wide atmosphere, soft vocal texture"})

[Verse 1]
${lyricTheme}
${styleLine}
Every heartbeat locks in time
Bass is crawling up my spine

[Pre-Chorus]
${energyLine}
Take control, don't slow it down
Feel the signal underground
We are rising through the sound

[Chorus]
${hookLine}
Feel the bass beneath your skin
Let it pull you deep within
No surrender, no rewind
We evolve inside the sound

[Verse 2]
Same fire, new direction
Built from pressure and connection
Every shadow knows my name
Every rhythm feeds the flame

[Bridge]
Break it down
Strip it bare
Only bass left in the air
Hold the silence
Shape the wave
Bring it back and let it cave

[Final Chorus]
${hookLine}
Feel the bass beneath your skin
Let it pull you deep within
No surrender, no rewind
We evolve inside the sound

[Outro]
(fading vocal echo)
Feel the bass
Evolve the sound`;
    } else {
      lyrics = `[Intro]
(ambient atmosphere, no lead vocal yet)

[Verse 1]
${lyricTheme}
${styleLine}
Every pulse is locked in time
Every echo bends the line

[Pre-Chorus]
${energyLine}
Take control, don't slow it down

[Chorus]
${hookLine}
Feel the bass beneath your skin
Let it pull you deep within

[Verse 2]
Same rhythm, new direction
Built on sound and tension

[Bridge]
Break it down, remove the weight
Silence bending into shape

[Chorus]
${hookLine}
Feel the bass beneath your skin
Let it pull you deep within

[Outro]
(fading energy, minimal vocal tail)`;
    }

    setGeneratedLyrics(lyrics);
    setStatusWithTime("Generated structured singable lyrics");
  };

  const generateVariations=()=>{
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
      {showSplash && <SplashOverlay onDismiss={dismissSplash} />}

      <canvas ref={canvasRef} className="hidden"/>
      <div className="fixed inset-0 pointer-events-none opacity-40" style={{background:"radial-gradient(circle at 18% 0%, rgba(184,115,51,.25), transparent 34%), radial-gradient(circle at 82% 12%, rgba(34,211,238,.16), transparent 36%), linear-gradient(135deg, rgba(255,255,255,.05), transparent 35%)"}}/>
      <div className="relative mx-auto max-w-7xl pb-12">
        <AppHeader appVersion={APP_VERSION} avgScore={avgScore} saveStatus={saveStatus} />

        <div className="grid gap-4 lg:grid-cols-[300px_1fr_380px]">
          <aside className="space-y-4">
            <Panel title="Style Presets" hint="Load factory or custom styles.">
              <div className="space-y-2">{Object.keys(stylePresets).map(name=><button key={name} onClick={()=>applyPreset(name)} className="w-full rounded-2xl border border-white/10 bg-black/25 p-3 text-left text-sm font-bold hover:border-cyan-300/50 hover:bg-cyan-300/10">{name}</button>)}</div>
              <div className="mt-4 rounded-2xl border border-orange-400/20 bg-orange-400/10 p-3"><div className="mb-2 text-xs font-bold uppercase tracking-wider text-orange-200">Save Current As Preset</div><input value={presetName} onChange={(e)=>setPresetName(e.target.value)} placeholder="Preset name..." className="mb-2 w-full rounded-xl border border-white/10 bg-black/30 p-2 text-sm text-white outline-none"/><button onClick={saveCustomPreset} className="w-full rounded-xl bg-orange-300 px-3 py-2 text-sm font-bold text-black hover:bg-orange-200">Save As Preset</button></div>
              {Object.keys(customPresets).length>0 && <div className="mt-4 space-y-2"><div className="text-xs font-bold uppercase tracking-wider text-white/45">Custom Presets</div>{Object.entries(customPresets).map(([name,p])=><div key={name} className="rounded-2xl border border-white/10 bg-black/25 p-2"><button onClick={()=>loadPresetObject(name,p)} className="w-full text-left text-sm font-bold text-cyan-100">{name}</button><button onClick={()=>deleteCustomPreset(name)} className="mt-2 text-xs font-bold text-red-300 hover:text-red-200">Delete</button></div>)}</div>}
            </Panel>

            <Panel title="Save / Load" hint="Keeps unfinished work safe."><div className="grid gap-2"><button onClick={saveProject} className="rounded-2xl bg-emerald-300 px-4 py-2 font-bold text-black hover:bg-emerald-200">Save Progress</button><button onClick={exportProject} className="rounded-2xl bg-cyan-300 px-4 py-2 font-bold text-black hover:bg-cyan-200">Export JSON</button><label className="cursor-pointer rounded-2xl bg-white px-4 py-2 text-center font-bold text-black hover:bg-cyan-100">Import JSON<input type="file" accept="application/json" onChange={importProject} className="hidden"/></label><button onClick={resetAll} className="rounded-2xl bg-red-400 px-4 py-2 font-bold text-black hover:bg-red-300">Reset to Default</button></div></Panel>
            <Panel title="Mode" hint="Controls stability vs creativity."><div className="grid grid-cols-3 gap-2">{["Control","Hybrid","Chaos"].map(m=><Pill key={m} active={mode===m} onClick={()=>setMode(m)}>{m}</Pill>)}</div></Panel>
            <Panel title="Pro Mode" hint="Advanced controls and stronger prompt shaping."><button onClick={()=>setProMode(!proMode)} className={"w-full rounded-2xl px-4 py-2 font-bold "+(proMode?"bg-purple-300 text-black":"bg-black/40 text-white border border-white/10")}>{proMode?"Pro Mode ON":"Pro Mode OFF"}</button>{proMode && <div className="mt-3 space-y-3"><Slider label="Prompt Intensity" value={promptIntensity} left="safe" right="experimental" setValue={setPromptIntensity}/><Slider label="Variations" value={variationCount} left="1" right="8" min={1} max={8} setValue={setVariationCount}/><div className="rounded-2xl border border-purple-300/20 bg-purple-300/10 p-3 text-xs text-purple-100">{intensityText}</div></div>}</Panel>
          </aside>

          <section className="space-y-4">
            <SunoGuidedPath
              promptEngine={promptEngine}
              onSelectSunoEngine={() => setPromptEngine("Suno-like")}
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
                    {lyricLanguageOptions.map(x => <option key={x}>{x}</option>)}
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

            <Panel title="Drag & Drop Analyzers" hint="Optional Polish-step tools — drop a track for a local report (waveform, draggable highlight, edit tags, merge into Suno fields, Goal, and Notes). Image DNA uses compact AUDIO:/IMAGE: lines sized for the 1000-character Style cap.">
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
                <span className="text-white/55">
                  Lyrics dir: {sunoFieldSlices.lyrics.length}/~{SUNO_LYRICS_CHAR_TYPICAL_MAX}
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
                      onApply={applyAudioToSunoStyle}
                      onClear={clearAudioAnalysis}
                      onAttachAudio={attachAudioFile}
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
                      <div className="rounded-2xl bg-black/30 p-3 text-xs text-white/70 whitespace-pre-wrap">{imageAnalysis.summary}</div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
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

            <Panel title="Step 3 — Clickable Music Controls" hint="Select genre, rhythm, sound modules, vocal mode, and style prompts from the library.">
              <div className="mb-4"><div className="mb-2 text-xs font-bold uppercase tracking-wider text-white/45">Genres</div><div className="flex flex-wrap gap-2">{genreOptions.map(x=><Pill key={x} active={selectedGenres.includes(x)} onClick={()=>toggle(x,selectedGenres,setSelectedGenres)}>{x}</Pill>)}</div></div>
              <StylePromptPicker
                selectedGenres={selectedGenres}
                setSelectedGenres={setSelectedGenres}
                rules={rules}
                setRules={setRules}
                setStatusWithTime={setStatusWithTime}
                defaultOpen
              />
              <div className="mb-4"><div className="mb-2 text-xs font-bold uppercase tracking-wider text-white/45">Rhythm</div><div className="flex flex-wrap gap-2">{rhythmOptions.map(x=><Pill key={x} active={selectedRhythms.includes(x)} onClick={()=>toggle(x,selectedRhythms,setSelectedRhythms)}>{x}</Pill>)}</div></div>
              <div className="mb-4"><div className="mb-2 text-xs font-bold uppercase tracking-wider text-white/45">Sound Modules</div><div className="flex flex-wrap gap-2">{soundOptions.map(x=><Pill key={x} active={selectedSounds.includes(x)} onClick={()=>toggle(x,selectedSounds,setSelectedSounds)}>{x}</Pill>)}</div></div>
              <div><div className="mb-2 text-xs font-bold uppercase tracking-wider text-white/45">Vocals</div><div className="flex flex-wrap gap-2">{vocalOptions.map(x=><Pill key={x} active={vocal===x} onClick={()=>setVocal(x)}>{x}</Pill>)}</div></div>
            </Panel>

            <Panel title="Step 4 — Co‑Producer Buttons" hint="One-click creative direction."><div className="flex flex-wrap gap-2">{["Make darker","More aggressive","More minimal","More cinematic","More club"].map(x=><button key={x} onClick={()=>coProducer(x)} className="rounded-2xl bg-white px-4 py-2 text-sm font-bold text-black hover:bg-cyan-100">{x}</button>)}</div></Panel>

            <Panel title="Co‑Producer AI" hint="One-click assistant that tightens your style, fixes weak spots, and generates hooks/lyrics.">
              <p className="mb-3 text-[11px] leading-relaxed text-white/50">
                <strong className="text-white/65">Copy guide:</strong> Lyric Style Generator = bracketed Suno direction only.
                Generate Lyrics with <strong className="text-white/65">Raw Prompt</strong> matches that format;{" "}
                <strong className="text-white/65">Structured Song</strong> /{" "}
                <strong className="text-white/65">Performance Ready</strong> output real [Verse]/[Chorus] lyric drafts.
              </p>
              <div className="grid gap-2 md:grid-cols-3">
                <button onClick={buildCoProducerAI} className="rounded-2xl bg-emerald-300 px-4 py-2 font-bold text-black hover:bg-emerald-200">
                  Improve Prompt
                </button>
                <button onClick={generateHooks} className="rounded-2xl bg-cyan-300 px-4 py-2 font-bold text-black hover:bg-cyan-200">
                  Generate Hooks
                </button>
                <button onClick={generateExampleLyrics} className="rounded-2xl bg-orange-300 px-4 py-2 font-bold text-black hover:bg-orange-200">
                  Generate Lyrics
                </button>
              </div>

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

              {generatedHooks && (
                <pre className="mt-3 max-h-52 overflow-auto whitespace-pre-wrap rounded-2xl border border-cyan-300/20 bg-black/50 p-4 text-xs leading-relaxed text-cyan-50">
                  {generatedHooks}
                </pre>
              )}

              {generatedLyrics && (
                <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-2xl border border-orange-300/20 bg-black/50 p-4 text-xs leading-relaxed text-orange-50">
                  {generatedLyrics}
                </pre>
              )}

              <div className="mt-3 grid gap-2 md:grid-cols-3">
                <button onClick={() => copyToClipboard(coProducerOutput || "", "Report copied")} className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/20">Copy Report</button>
                <button onClick={() => copyToClipboard(generatedHooks || "", "Hooks copied")} className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/20">Copy Hooks</button>
                <button onClick={() => copyToClipboard(generatedLyrics || "", "Lyrics copied")} className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/20">Copy Lyrics</button>
              </div>
            </Panel>

            <Panel title="Variation Engine" hint="Auto-generate prompt versions while keeping your core identity."><button onClick={generateVariations} className="w-full rounded-2xl bg-fuchsia-300 px-4 py-2 font-bold text-black hover:bg-fuchsia-200">Generate {variationCount} Variations</button>{variations.length>0 && <div className="mt-3 space-y-3">{variations.map(v=><div key={v.id} className="rounded-2xl border border-white/10 bg-black/30 p-3"><div className="mb-2 font-bold text-fuchsia-200">{v.title}</div><pre className="max-h-48 overflow-auto whitespace-pre-wrap text-xs text-white/70">{v.prompt}</pre><button onClick={()=>copyToClipboard(v.prompt, `${v.title} copied`)} className="mt-2 rounded-xl bg-white px-3 py-1 text-xs font-bold text-black hover:bg-cyan-100">Copy Variation</button></div>)}</div>}</Panel>

            {proMode && <Panel title="Advanced Override" hint="Optional text editing for exact control."><div className="grid gap-3 md:grid-cols-2"><label><div className="mb-1 text-xs font-bold uppercase tracking-wider text-white/45">Tempo</div><input value={tempo} onChange={(e)=>setTempo(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-white outline-none"/></label><label><div className="mb-1 text-xs font-bold uppercase tracking-wider text-white/45">Structure</div><input value={structure} onChange={(e)=>setStructure(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-white outline-none"/></label></div><div className="mt-3 grid gap-3 md:grid-cols-2"><TextBox label="Rules" value={rules} setValue={setRules}/><TextBox label="Notes / Analyzer Output" value={notes} setValue={setNotes}/></div></Panel>}
          </section>

          <aside className="space-y-4">
            <Panel title="Prompt Preview" hint="Copy this into Suno or another AI music tool."><pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-2xl border border-cyan-300/20 bg-black/50 p-4 text-xs leading-relaxed text-cyan-50">{prompt}</pre><div className="mt-3 grid grid-cols-2 gap-2"><button onClick={copyPrompt} className="rounded-2xl bg-cyan-300 px-4 py-2 font-bold text-black hover:bg-cyan-200">{copied?"Copied!":"Copy Prompt"}</button><button onClick={()=>addHistory("Manual snapshot")} className="rounded-2xl bg-white px-4 py-2 font-bold text-black hover:bg-cyan-100">Save Snapshot</button></div>{promptEngine === "Suno-like" && sunoSlices ? (<div className="mt-2 grid grid-cols-2 gap-2"><button type="button" onClick={()=>copyToClipboard(sunoSlices.style,"Suno Style box copied")} className="rounded-2xl border border-cyan-400/35 bg-cyan-500/15 px-4 py-2 text-xs font-bold text-cyan-100 hover:bg-cyan-500/25">Copy Style box</button><button type="button" onClick={()=>copyToClipboard(sunoSlices.lyrics,"Suno Lyrics field copied")} className="rounded-2xl border border-fuchsia-400/35 bg-fuchsia-500/15 px-4 py-2 text-xs font-bold text-fuchsia-100 hover:bg-fuchsia-500/25">Copy Lyrics field</button></div>) : null}</Panel>
            <Panel title="Analyzer / Debug" hint="Find weak spots and apply fixes."><button onClick={analyze} className="mb-3 w-full rounded-2xl bg-purple-300 px-4 py-2 font-bold text-black hover:bg-purple-200">Analyze Prompt</button><select value={issue} onChange={(e)=>setIssue(e.target.value)} className="mb-3 w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-white outline-none">{Object.keys(fixes).map(x=><option key={x}>{x}</option>)}</select><div className="mb-3 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-3 text-xs text-amber-50">{fixes[issue]}</div><button onClick={applyFix} className="w-full rounded-2xl bg-amber-300 px-4 py-2 font-bold text-black hover:bg-amber-200">Apply Fix To Rules</button></Panel>
            {promptEngine === "Suno-like" && (
              <Panel title="Suno-like Validator" hint="Checks structured style/prompt constraints before copying.">
                {sunoSlices ? (
                  <div className="mb-3 rounded-2xl border border-white/10 bg-black/35 p-3 text-[10px] leading-relaxed text-white/55">
                    <div className="font-bold text-cyan-100/90">Suno field lengths (typical caps)</div>
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
            <Panel title="Suno Language Index" hint="Community-derived prompting vocabulary (non-official).">
                <div className="space-y-3 text-xs text-white/80">
                  <p className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-3 text-[11px] text-white/55">
                    Browse and add style prompts in <strong className="text-cyan-100">Step 3 → Style prompt library</strong>{" "}
                    (section dropdown + multi-select → Add to Styles).
                  </p>
                  <div>
                    <div className="mb-1 font-bold text-cyan-200">Core Principles</div>
                    <ul className="space-y-1 text-white/70">
                      {sunoLanguageIndex.principles.map((p, i) => (
                        <li key={i}>- {p}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="mb-1 font-bold text-cyan-200">Structure Tags</div>
                    <div className="rounded-2xl border border-white/10 bg-black/30 p-2 text-white/70">
                      {sunoLanguageIndex.structureTags.map((tag) => `[${tag}]`).join("  ")}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-amber-400/25 bg-amber-500/10 p-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="font-bold text-amber-100">Prompt symbol overview</div>
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(formatPromptSymbolGuidePlain(), "Symbol guide copied")
                        }
                        className="rounded-xl border border-amber-300/40 bg-amber-400/20 px-2 py-1 text-[11px] font-bold text-amber-50 hover:bg-amber-400/30"
                      >
                        Copy full symbol guide
                      </button>
                    </div>
                    <p className="mb-2 text-[11px] text-amber-100/70">
                      Delimiter roles (comma, semicolon, brackets, pipes, etc.) + examples for style
                      prompts and registers.
                    </p>
                    <div className="max-h-[min(220px,35vh)] overflow-auto rounded-xl border border-white/10 bg-black/40">
                      <table className="w-full border-collapse text-left text-[10px] text-white/75">
                        <thead className="sticky top-0 bg-black/80 text-amber-100/90">
                          <tr>
                            <th className="border-b border-white/10 p-2">Symbol</th>
                            <th className="border-b border-white/10 p-2">Meaning</th>
                            <th className="border-b border-white/10 p-2">Example</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(sunoLanguageIndex.promptSymbolOverview || []).map((row, idx) => (
                            <tr key={`sym-${idx}`} className="border-b border-white/5">
                              <td className="align-top p-2 font-mono text-cyan-100/90">
                                <div className="whitespace-nowrap">
                                  {"symbolAlt" in row && row.symbolAlt
                                    ? `${row.symbol} (${row.symbolAlt})`
                                    : row.symbol}
                                </div>
                                <div className="mt-0.5 text-[9px] font-sans font-normal text-white/40">
                                  {row.label}
                                </div>
                              </td>
                              <td className="align-top p-2">{row.role}</td>
                              <td className="align-top p-2 text-white/60">{row.example}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <ul className="mt-2 space-y-1 text-[11px] text-white/65">
                      {(sunoLanguageIndex.promptSymbolUsageTips || []).map((t, i) => (
                        <li key={`tip-${i}`}>- {t}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                    <div className="mb-2 font-bold text-cyan-200">Delimiter examples</div>
                    <div className="max-h-[min(280px,40vh)] space-y-2 overflow-y-auto">
                      {Object.entries(sunoLanguageIndex.promptSymbolExamples || {}).map(
                        ([key, lines]) => (
                          <details
                            key={key}
                            className="rounded-xl border border-white/10 bg-black/40 open:border-cyan-400/25"
                          >
                            <summary className="cursor-pointer px-3 py-2 text-[11px] font-bold text-cyan-100 marker:text-cyan-300">
                              {key.replace(/([A-Z])/g, " $1").trim()}
                            </summary>
                            <pre className="max-h-32 overflow-auto whitespace-pre-wrap px-3 pb-3 text-[11px] leading-relaxed text-white/65">
                              {(lines || []).join("\n")}
                            </pre>
                            <div className="px-3 pb-3">
                              <button
                                type="button"
                                onClick={() =>
                                  copyToClipboard((lines || []).join("\n"), `${key} examples copied`)
                                }
                                className="rounded-xl bg-white/10 px-2 py-1 text-[11px] font-bold text-white hover:bg-white/20"
                              >
                                Copy
                              </button>
                            </div>
                          </details>
                        ),
                      )}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-rose-400/30 bg-rose-950/40 p-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="font-bold text-rose-100">
                        {sunoLanguageIndex.sunoVocalArtifactGuide?.title ||
                          "Vocal texture vs lyrics (DnB / Jungle / dub)"}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(
                            formatVocalArtifactGuidePlain(),
                            "Vocal artifact guide copied",
                          )
                        }
                        className="rounded-xl border border-rose-300/35 bg-rose-400/20 px-2 py-1 text-[11px] font-bold text-rose-50 hover:bg-rose-400/30"
                      >
                        Copy full guide
                      </button>
                    </div>
                    <p className="mb-2 text-[11px] text-rose-100/75">
                      {sunoLanguageIndex.sunoVocalArtifactGuide?.summary}
                    </p>
                    <div className="max-h-[min(340px,45vh)] space-y-3 overflow-y-auto text-[11px] text-white/75">
                      {(sunoLanguageIndex.sunoVocalArtifactGuide?.causes || []).map((c, i) => (
                        <div key={`cause-${i}`} className="rounded-xl border border-white/10 bg-black/35 p-2">
                          <div className="font-bold text-rose-100/95">{c.heading}</div>
                          <ul className="mt-1 list-disc space-y-1 pl-4">
                            {(c.bullets || []).map((b, j) => (
                              <li key={j}>{b}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                      {(sunoLanguageIndex.sunoVocalArtifactGuide?.fixes || []).map((f, i) => (
                        <div key={`fix-${i}`} className="rounded-xl border border-emerald-400/20 bg-emerald-950/30 p-2">
                          <div className="font-bold text-emerald-100">{f.heading}</div>
                          <ul className="mt-1 list-disc space-y-1 pl-4">
                            {(f.bullets || []).map((b, j) => (
                              <li key={j}>{b}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                      <div className="rounded-xl border border-cyan-400/25 bg-black/40 p-2 font-mono text-[10px] text-cyan-50/90">
                        <div className="font-bold text-cyan-100">
                          {(sunoLanguageIndex.sunoVocalArtifactGuide || {}).diagnostic?.heading}
                        </div>
                        <div className="mt-1 whitespace-pre-wrap">
                          Before: {(sunoLanguageIndex.sunoVocalArtifactGuide || {}).diagnostic?.before}
                          {"\n"}
                          After: {(sunoLanguageIndex.sunoVocalArtifactGuide || {}).diagnostic?.after}
                          {"\n"}
                          {(sunoLanguageIndex.sunoVocalArtifactGuide || {}).diagnostic?.note}
                        </div>
                      </div>
                      <p className="text-white/70">
                        {(sunoLanguageIndex.sunoVocalArtifactGuide || {}).bottomLine}
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-2 md:grid-cols-3">
                    <button onClick={() => copyToClipboard(sunoLanguageIndex.templates.styleField, "Suno style template copied")} className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 font-bold text-white hover:bg-white/20">
                      Copy Style Template
                    </button>
                    <button onClick={() => copyToClipboard(sunoLanguageIndex.templates.lyricsField, "Suno lyrics template copied")} className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 font-bold text-white hover:bg-white/20">
                      Copy Lyrics Template
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(
                          sunoLanguageIndex.templates.lyricsFieldAdvanced,
                          "Advanced lyrics template copied",
                        )
                      }
                      className="rounded-2xl border border-fuchsia-400/35 bg-fuchsia-500/15 px-3 py-2 font-bold text-fuchsia-100 hover:bg-fuchsia-500/25"
                    >
                      Copy Advanced Lyrics
                    </button>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                    <div className="mb-2 font-bold text-fuchsia-200">Quick lyric snippets</div>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(sunoLanguageIndex.templates.lyricSnippets || {}).map(
                        ([key, text]) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() =>
                              copyToClipboard(text, `${key.replace(/([A-Z])/g, " $1").trim()} copied`)
                            }
                            className="rounded-xl border border-white/15 bg-white/5 px-2 py-1 text-[11px] font-bold text-white/85 hover:bg-white/15"
                          >
                            {key.replace(/([A-Z])/g, " $1").trim()}
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                    <div className="mb-2 font-bold text-fuchsia-200">Advanced Suno lyric cookbook</div>
                    <p className="mb-2 text-[11px] text-white/55">
                      Meta intros, curly FX, SATB, build/drop, duets — paste into Suno&apos;s Lyrics box.
                    </p>
                    <div className="max-h-[min(320px,40vh)] space-y-2 overflow-y-auto">
                      {(sunoLanguageIndex.advancedLyricCookbook || []).map((item) => (
                        <details
                          key={item.id}
                          className="rounded-xl border border-white/10 bg-black/40 open:border-fuchsia-400/30"
                        >
                          <summary className="cursor-pointer px-3 py-2 text-[11px] font-bold text-fuchsia-100 marker:text-fuchsia-300">
                            {item.title}
                          </summary>
                          <pre className="max-h-40 overflow-auto whitespace-pre-wrap px-3 pb-2 text-[11px] leading-relaxed text-white/70">
                            {item.body}
                          </pre>
                          <div className="px-3 pb-3">
                            <button
                              type="button"
                              onClick={() =>
                                copyToClipboard(item.body, `${item.title} copied`)
                              }
                              className="rounded-xl bg-fuchsia-400/90 px-2 py-1 text-[11px] font-bold text-black hover:bg-fuchsia-300"
                            >
                              Copy
                            </button>
                          </div>
                        </details>
                      ))}
                    </div>
                  </div>
                  <button onClick={applyGenreAnchors} className="w-full rounded-2xl bg-cyan-300 px-3 py-2 font-bold text-black hover:bg-cyan-200">
                    Apply Genre Anchors
                  </button>
                  <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="font-bold text-cyan-200">Style prompt index (copy only)</div>
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(
                            flattenStylePromptCatalog(stylePromptCatalog),
                            "Full style index copied",
                          )
                        }
                        className="rounded-xl border border-white/15 bg-white/10 px-2 py-1 text-[11px] font-bold text-white hover:bg-white/20"
                      >
                        Copy all sections
                      </button>
                    </div>
                    <p className="text-[11px] text-white/45">
                      To add prompts into your track identity, use Step 3 Style prompt library instead of copy-paste.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                    <div className="mb-2 font-bold text-cyan-200">Reference prompt blocks</div>
                    <p className="mb-2 text-[11px] text-white/55">
                      Long-form examples (trim lines before pasting into Suno).
                    </p>
                    <div className="max-h-[min(380px,45vh)] space-y-2 overflow-y-auto">
                      {referencePromptBlocks.map((block) => (
                        <details
                          key={block.id}
                          className="rounded-xl border border-white/10 bg-black/40 open:border-orange-300/25"
                        >
                          <summary className="cursor-pointer px-3 py-2 text-[11px] font-bold text-orange-100 marker:text-orange-300">
                            {block.title}
                          </summary>
                          <pre className="max-h-48 overflow-auto whitespace-pre-wrap px-3 pb-2 text-[11px] leading-relaxed text-white/70">
                            {block.body}
                          </pre>
                          <div className="px-3 pb-3">
                            <button
                              type="button"
                              onClick={() =>
                                copyToClipboard(block.body, `${block.title} copied`)
                              }
                              className="rounded-xl bg-orange-300/90 px-2 py-1 text-[11px] font-bold text-black hover:bg-orange-200"
                            >
                              Copy block
                            </button>
                          </div>
                        </details>
                      ))}
                    </div>
                  </div>
                </div>
              </Panel>
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
