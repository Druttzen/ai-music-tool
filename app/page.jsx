"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { DropBox, Panel, Pill, Slider, TextBox } from "./components/ui-blocks";
import { useClipboard } from "./hooks/use-clipboard";
import { useStatusMessage } from "./hooks/use-status-message";
import { buildSunoLikePrompt, validateSunoLikePrompt } from "./lib/suno-rules";
import { sunoLanguageIndex } from "./lib/suno-language-index";
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
import { buildLyricPrompt, clamp, getIntensityText, getVocalText, uniq } from "./lib/music-helpers";

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
  const [presetName,setPresetName]=useState("");
  const [customPresets,setCustomPresets]=useState({});
  const [history,setHistory]=useState([]);
  const [variations,setVariations]=useState([]);
  const [selectedHistoryId,setSelectedHistoryId]=useState(null);
  const [showSplash, setShowSplash] = useState(true);

  const [audioAnalysis,setAudioAnalysis]=useState(null);
  const [imageAnalysis,setImageAnalysis]=useState(null);
  const [imagePreview,setImagePreview]=useState(null);
  const canvasRef = useRef(null);
  const imagePreviewUrlRef = useRef(null);
  const lastAutosavePayloadRef = useRef("");

  const currentState = useMemo(()=>({ idea, tempo, structure, selectedGenres, selectedRhythms, selectedSounds, vocal, mode, proMode, promptIntensity, variationCount, rules, notes, scores, mood, audioAnalysis, imageAnalysis, lyricTheme, lyricLanguage, lyricStructure, lyricStyle, lyricDensity, promptFormat, promptEngine, coProducerOutput, generatedLyrics, generatedHooks, lyricMode }), [idea,tempo,structure,selectedGenres,selectedRhythms,selectedSounds,vocal,mode,proMode,promptIntensity,variationCount,rules,notes,scores,mood,audioAnalysis,imageAnalysis,lyricTheme,lyricLanguage,lyricStructure,lyricStyle,lyricDensity,promptFormat,promptEngine,coProducerOutput,generatedLyrics,generatedHooks,lyricMode]);

  const loadState=(data)=>{
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
  };

  const resetAll=()=>{ loadState(DEFAULT_STATE); setVariations([]); setAudioAnalysis(null); setImageAnalysis(null); setImagePreview(null); localStorage.removeItem(STORAGE_KEY); setStatusWithTime("Reset to default"); };

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 1800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(()=>{
    try{
      const saved=localStorage.getItem(STORAGE_KEY); if(saved){ loadState(JSON.parse(saved)); setStatusWithTime("Loaded saved project"); }
      const presets=localStorage.getItem(PRESET_KEY); if(presets) setCustomPresets(JSON.parse(presets));
      const hist=localStorage.getItem(HISTORY_KEY); if(hist) setHistory(JSON.parse(hist));
    }catch{ setStatusWithTime("Could not load saved data"); }
  },[]);

  useEffect(() => {
    return () => {
      if (imagePreviewUrlRef.current) {
        URL.revokeObjectURL(imagePreviewUrlRef.current);
        imagePreviewUrlRef.current = null;
      }
    };
  }, []);

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

  const vocalText=useMemo(()=>getVocalText(vocal),[vocal]);


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
  }, [promptEngine, promptFormat, compressedPrompt, detailedPrompt, selectedGenres, tempo, moodWords, selectedSounds, selectedRhythms, vocalText, idea, vocal, lyricPrompt, rules, intensityText, mode, coProducerOutput]);

  const sunoWarnings = useMemo(
    () =>
      validateSunoLikePrompt({
        selectedGenres,
        selectedSounds,
        selectedRhythms,
        vocal,
        rules,
        structure,
        idea,
      }),
    [selectedGenres, selectedSounds, selectedRhythms, vocal, rules, structure, idea]
  );

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
    if (vocal === "Instrumental" && !rules.toLowerCase().includes("no vocal")) {
      setRules((prev) => `${prev}${prev.trim() ? "\n" : ""}no vocals, no vocal chops, no mumbled speech`);
    }
    if (selectedGenres.length > 2) {
      setSelectedGenres(selectedGenres.slice(0, 2));
    }
    setStatusWithTime("Applied Suno-like auto-fixes");
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
    const next={...customPresets,[name]:{ genres:selectedGenres, rhythms:selectedRhythms, sounds:selectedSounds, vocal, tempo, structure, mood, rules, mode, promptIntensity }};
    setCustomPresets(next); localStorage.setItem(PRESET_KEY,JSON.stringify(next,null,2)); setPresetName(""); setStatusWithTime(`Saved preset: ${name}`);
  };

  const loadPresetObject=(name,p)=>{
    setSelectedGenres(p.genres ?? DEFAULT_STATE.selectedGenres); setSelectedRhythms(p.rhythms ?? DEFAULT_STATE.selectedRhythms); setSelectedSounds(p.sounds ?? DEFAULT_STATE.selectedSounds);
    setVocal(p.vocal ?? DEFAULT_STATE.vocal); setTempo(p.tempo ?? DEFAULT_STATE.tempo); setStructure(p.structure ?? DEFAULT_STATE.structure);
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

  const analyzeAudioFile = async (file) => {
    let audioContext = null;
    try {
      setStatusWithTime("Analyzing audio...");
      const arrayBuffer = await file.arrayBuffer();
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const buffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
      const channel = buffer.getChannelData(0);
      const sampleRate = buffer.sampleRate;
      const duration = buffer.duration;

      let sum = 0, peak = 0, zeroCrossings = 0;
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
      const estimatedBpm = duration < 20 ? "120 BPM" : `${Math.round(clamp(80 + energy * 0.7 + complexity * 0.25, 70, 180))} BPM`;

      const suggestedSounds = [];
      if (energy > 60) suggestedSounds.push("Heavy sub bass", "Big drums");
      if (aggression > 65) suggestedSounds.push("Distorted bass", "Metallic percussion");
      if (brightness > 55) suggestedSounds.push("Bright leads", "Glitch FX");
      if (darkness > 60) suggestedSounds.push("Dark pads", "Noise atmosphere");

      const suggestedRhythms = energy > 70 ? ["4/4", "Syncopated"] : complexity > 60 ? ["Breakbeat", "Off-grid"] : ["Minimal"];

      const summary = `File: ${file.name}
Duration: ${duration.toFixed(1)}s
Detected energy: ${energy}/100
Detected aggression: ${aggression}/100
Detected brightness: ${brightness}/100
Suggested tempo: ${estimatedBpm}
Suggested rhythm: ${suggestedRhythms.join(", ")}
Suggested sound: ${uniq(suggestedSounds).join(", ") || "balanced instruments and textures"}
Interpretation: ${energy > 70 ? "high-impact and club-ready" : energy < 35 ? "calm and atmospheric" : "controlled and balanced"} sound source.`;

      setAudioAnalysis({ fileName: file.name, duration, energy, aggression, brightness, estimatedBpm, suggestedSounds: uniq(suggestedSounds), suggestedRhythms, summary });
      setTempo(estimatedBpm);
      setSelectedSounds(s => uniq([...s, ...suggestedSounds]));
      setSelectedRhythms(r => uniq([...r, ...suggestedRhythms]));
      setMood(m => ({ ...m, energy, aggression, darkness, complexity }));
      setNotes(`Audio analysis applied:\n${summary}`);
      setStatusWithTime("Audio analysis applied");
    } catch (err) {
      setStatusWithTime("Audio analysis failed");
      setNotes("Audio analysis failed. Use WAV/MP3/OGG/M4A if supported by your browser/Electron.");
    } finally {
      if (audioContext) {
        try { await audioContext.close(); } catch {}
      }
    }
  };

  const analyzeImageFile = async (file) => {
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
        canvas.width = w; canvas.height = h;
        ctx.drawImage(img, 0, 0, w, h);
        const data = ctx.getImageData(0,0,w,h).data;

        let r=0,g=0,b=0, brightness=0, saturation=0, contrast=0;
        const luminances = [];
        const pixels = data.length / 4;

        for(let i=0;i<data.length;i+=4){
          const rr=data[i], gg=data[i+1], bb=data[i+2];
          r+=rr; g+=gg; b+=bb;
          const max=Math.max(rr,gg,bb), min=Math.min(rr,gg,bb);
          const lum=(0.2126*rr+0.7152*gg+0.0722*bb);
          brightness += lum;
          saturation += max === 0 ? 0 : ((max-min)/max)*100;
          luminances.push(lum);
        }
        r=Math.round(r/pixels); g=Math.round(g/pixels); b=Math.round(b/pixels);
        brightness = brightness/pixels;
        saturation = saturation/pixels;
        const mean = brightness;
        for(const lum of luminances) contrast += Math.abs(lum-mean);
        contrast = contrast/luminances.length;

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
          space: clamp(bright ? 75 : cool ? 68 : 50)
        };

        const imgGenres = [];
        const imgSounds = [];
        const imgRhythms = [];

        if (dark && highContrast) { imgGenres.push("Industrial", "Techno"); imgSounds.push("Metallic percussion", "Distorted bass", "Noise atmosphere"); imgRhythms.push("4/4", "Syncopated"); }
        if (cool) { imgGenres.push("Ambient", "Cinematic"); imgSounds.push("Dark pads", "Dub delays"); imgRhythms.push("Minimal"); }
        if (warm && vivid) { imgGenres.push("House", "Pop"); imgSounds.push("Bright leads", "Big drums"); imgRhythms.push("4/4"); }
        if (bright && !vivid) { imgGenres.push("Ambient", "Orchestral"); imgSounds.push("Piano", "Orchestral strings", "Soft drums"); imgRhythms.push("Minimal"); }
        if (vivid && highContrast) { imgGenres.push("Experimental"); imgSounds.push("Glitch FX", "Analog synths"); imgRhythms.push("Off-grid"); }

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

        setImageAnalysis({ fileName:file.name, avgColor:`rgb(${r}, ${g}, ${b})`, brightness, saturation, contrast, visualMood, suggestedGenres:uniq(imgGenres), suggestedSounds:uniq(imgSounds), suggestedRhythms:uniq(imgRhythms), summary });
        setMood(newMood);
        setSelectedGenres(g0 => uniq([...g0, ...imgGenres]).slice(0, 6));
        setSelectedSounds(s0 => uniq([...s0, ...imgSounds]));
        setSelectedRhythms(r0 => uniq([...r0, ...imgRhythms]));
        setIdea(`music inspired by image: ${visualMood} visual energy, translated into sound design`);
        setNotes(`Image analysis applied:\n${summary}`);
        setStatusWithTime("Image analysis applied");
      };
      img.onerror = () => setStatusWithTime("Image analysis failed");
      img.src = url;
    } catch {
      setStatusWithTime("Image analysis failed");
    }
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
    const core = lyricTheme || idea;
    const energyWord = mood.energy > 70 ? "ignite" : "breathe";
    const darkWord = mood.darkness > 65 ? "night" : "light";
    const hooks = `HOOK IDEAS

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
      setGeneratedLyrics("Instrumental mode is active. Switch vocal mode to generate lyrics.");
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
      lyrics = `[LYRIC DIRECTION]
Language: ${lyricLanguage}
Theme: ${lyricTheme}
Style: ${lyricStyle}
Mood: ${moodWords}
Write short, singable lines with a strong repeated hook.
Use [VERSE], [CHORUS], [BRIDGE], and [OUTRO] tags.`;
    } else if (lyricMode === "Performance Ready") {
      lyrics = `[INTRO]
(${mood.darkness > 65 ? "dark atmosphere, distant vocal texture" : "wide atmosphere, soft vocal texture"})

[VERSE 1]
${lyricTheme}
${styleLine}
Every heartbeat locks in time
Bass is crawling up my spine

[PRE-CHORUS]
${energyLine}
Take control, don't slow it down
Feel the signal underground
We are rising through the sound

[CHORUS]
${hookLine}
Feel the bass beneath your skin
Let it pull you deep within
No surrender, no rewind
We evolve inside the sound

[VERSE 2]
Same fire, new direction
Built from pressure and connection
Every shadow knows my name
Every rhythm feeds the flame

[BRIDGE]
Break it down
Strip it bare
Only bass left in the air
Hold the silence
Shape the wave
Bring it back and let it cave

[FINAL CHORUS]
${hookLine}
Feel the bass beneath your skin
Let it pull you deep within
No surrender, no rewind
We evolve inside the sound

[OUTRO]
(fading vocal echo)
Feel the bass
Evolve the sound`;
    } else {
      lyrics = `[INTRO]
(ambient atmosphere, no lead vocal yet)

[VERSE 1]
${lyricTheme}
${styleLine}
Every pulse is locked in time
Every echo bends the line

[PRE-CHORUS]
${energyLine}
Take control, don't slow it down

[CHORUS]
${hookLine}
Feel the bass beneath your skin
Let it pull you deep within

[VERSE 2]
Same rhythm, new direction
Built on sound and tension

[BRIDGE]
Break it down, remove the weight
Silence bending into shape

[CHORUS]
${hookLine}
Feel the bass beneath your skin
Let it pull you deep within

[OUTRO]
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
      {showSplash && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0b0d10]">
          <div className="absolute inset-0 opacity-60" style={{background:"radial-gradient(circle at center, rgba(184,115,51,.28), transparent 35%), radial-gradient(circle at 65% 35%, rgba(34,211,238,.18), transparent 30%)"}} />
          <div className="relative mx-6 max-w-xl rounded-[2rem] border border-orange-300/25 bg-black/60 p-8 text-center shadow-2xl backdrop-blur">
            <img src="./bones-logo.png" alt="BONES VIBRATION logo" className="mx-auto mb-4 max-h-44 w-auto object-contain drop-shadow-[0_0_35px_rgba(249,115,22,0.45)]" />
            <div className="text-xs font-black uppercase tracking-[0.35em] text-orange-300">BONES VIBRATION</div>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-white">AI Music Creator</h1>
            <p className="mt-3 text-sm text-white/55">Loading Prompt Control Room...</p>
            <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-orange-300" />
            </div>
            <button onClick={() => setShowSplash(false)} className="mt-5 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-bold text-white/70 hover:bg-white/20">
              Skip intro
            </button>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden"/>
      <div className="fixed inset-0 opacity-40" style={{background:"radial-gradient(circle at 18% 0%, rgba(184,115,51,.25), transparent 34%), radial-gradient(circle at 82% 12%, rgba(34,211,238,.16), transparent 36%), linear-gradient(135deg, rgba(255,255,255,.05), transparent 35%)"}}/>
      <div className="relative mx-auto max-w-7xl pb-12">
        <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div><div className="mb-2 inline-flex rounded-full border border-orange-300/25 bg-orange-300/10 px-3 py-1 text-xs font-black tracking-wider text-orange-200">BONES VIBRATION • AI MUSIC CREATOR</div><h1 className="bg-gradient-to-r from-white via-orange-200 to-cyan-200 bg-clip-text text-4xl font-black tracking-tight text-transparent md:text-6xl">Prompt Control Room</h1><p className="mt-2 max-w-2xl text-white/55">Level 2 visual prompt engine with audio analysis, image-to-style, presets, variations, history, Pro Mode, and extracted source prompts.</p><div className="mt-4 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wider text-white/45"><span className="rounded-full border border-white/10 bg-black/25 px-3 py-1">v{APP_VERSION}</span><span className="rounded-full border border-orange-300/20 bg-orange-300/10 px-3 py-1 text-orange-200">DJ M@D</span><span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-cyan-200">Level 2 Analyzer</span></div></div>
          <div className="hidden rounded-[2rem] border border-orange-300/15 bg-black/25 p-3 shadow-2xl md:flex items-center justify-center"><img src="./bones-logo.png" alt="BONES VIBRATION logo" className="max-h-48 w-auto object-contain drop-shadow-[0_0_35px_rgba(249,115,22,0.45)]"/></div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-4"><div className="text-xs text-white/50">Project status</div><div className="text-sm font-bold text-cyan-100">{saveStatus}</div><div className="mt-2 text-xs text-white/50">Average score</div><div className="text-3xl font-black text-cyan-200">{avgScore}/5</div></div>
        </header>

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
            <Panel title="Step 1 — Idea Input" hint="Describe what you want in plain language."><input value={idea} onChange={(e)=>setIdea(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-white outline-none focus:border-cyan-300"/></Panel>


            <Panel title="Lyric Style Generator" hint="Creates relevant lyric direction based on genre, vocal mode, mood, and theme.">
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

            <Panel title="Drag & Drop Analyzers" hint="Drop audio to extract energy/groove, or drop an image to convert visual mood into music style.">
              <div className="grid gap-3 md:grid-cols-2">
                <DropBox title="Drop Audio File" hint="WAV / MP3 / OGG / M4A" accept="audio/*" onFile={analyzeAudioFile}>
                  {audioAnalysis && <div className="mt-3 rounded-2xl bg-black/30 p-3 text-left text-xs text-white/70 whitespace-pre-wrap">{audioAnalysis.summary}</div>}
                </DropBox>
                <DropBox title="Drop Image File" hint="JPG / JPEG / PNG → music style" accept="image/jpeg,image/jpg,image/png" onFile={analyzeImageFile}>
                  {imagePreview && <img src={imagePreview} alt="Image preview" className="mx-auto mt-3 max-h-40 rounded-2xl object-contain"/>}
                  {imageAnalysis && <div className="mt-3 rounded-2xl bg-black/30 p-3 text-left text-xs text-white/70 whitespace-pre-wrap">{imageAnalysis.summary}</div>}
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

            <Panel title="Step 3 — Clickable Music Controls" hint="Select genre, rhythm, sound modules, and vocal mode.">
              <div className="mb-4"><div className="mb-2 text-xs font-bold uppercase tracking-wider text-white/45">Genres</div><div className="flex flex-wrap gap-2">{genreOptions.map(x=><Pill key={x} active={selectedGenres.includes(x)} onClick={()=>toggle(x,selectedGenres,setSelectedGenres)}>{x}</Pill>)}</div></div>
              <div className="mb-4"><div className="mb-2 text-xs font-bold uppercase tracking-wider text-white/45">Rhythm</div><div className="flex flex-wrap gap-2">{rhythmOptions.map(x=><Pill key={x} active={selectedRhythms.includes(x)} onClick={()=>toggle(x,selectedRhythms,setSelectedRhythms)}>{x}</Pill>)}</div></div>
              <div className="mb-4"><div className="mb-2 text-xs font-bold uppercase tracking-wider text-white/45">Sound Modules</div><div className="flex flex-wrap gap-2">{soundOptions.map(x=><Pill key={x} active={selectedSounds.includes(x)} onClick={()=>toggle(x,selectedSounds,setSelectedSounds)}>{x}</Pill>)}</div></div>
              <div><div className="mb-2 text-xs font-bold uppercase tracking-wider text-white/45">Vocals</div><div className="flex flex-wrap gap-2">{vocalOptions.map(x=><Pill key={x} active={vocal===x} onClick={()=>setVocal(x)}>{x}</Pill>)}</div></div>
            </Panel>

            <Panel title="Step 4 — Co‑Producer Buttons" hint="One-click creative direction."><div className="flex flex-wrap gap-2">{["Make darker","More aggressive","More minimal","More cinematic","More club"].map(x=><button key={x} onClick={()=>coProducer(x)} className="rounded-2xl bg-white px-4 py-2 text-sm font-bold text-black hover:bg-cyan-100">{x}</button>)}</div></Panel>

            <Panel title="Co‑Producer AI" hint="One-click assistant that tightens your style, fixes weak spots, and generates hooks/lyrics.">
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
            <Panel title="Prompt Preview" hint="Copy this into Suno or another AI music tool."><pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-2xl border border-cyan-300/20 bg-black/50 p-4 text-xs leading-relaxed text-cyan-50">{prompt}</pre><div className="mt-3 grid grid-cols-2 gap-2"><button onClick={copyPrompt} className="rounded-2xl bg-cyan-300 px-4 py-2 font-bold text-black hover:bg-cyan-200">{copied?"Copied!":"Copy Prompt"}</button><button onClick={()=>addHistory("Manual snapshot")} className="rounded-2xl bg-white px-4 py-2 font-bold text-black hover:bg-cyan-100">Save Snapshot</button></div></Panel>
            <Panel title="Analyzer / Debug" hint="Find weak spots and apply fixes."><button onClick={analyze} className="mb-3 w-full rounded-2xl bg-purple-300 px-4 py-2 font-bold text-black hover:bg-purple-200">Analyze Prompt</button><select value={issue} onChange={(e)=>setIssue(e.target.value)} className="mb-3 w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-white outline-none">{Object.keys(fixes).map(x=><option key={x}>{x}</option>)}</select><div className="mb-3 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-3 text-xs text-amber-50">{fixes[issue]}</div><button onClick={applyFix} className="w-full rounded-2xl bg-amber-300 px-4 py-2 font-bold text-black hover:bg-amber-200">Apply Fix To Rules</button></Panel>
            {promptEngine === "Suno-like" && (
              <Panel title="Suno-like Validator" hint="Checks structured style/prompt constraints before copying.">
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
            {promptEngine === "Suno-like" && (
              <Panel title="Suno Language Index" hint="Community-derived prompting vocabulary (non-official).">
                <div className="space-y-3 text-xs text-white/80">
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
                  <div className="grid gap-2 md:grid-cols-2">
                    <button onClick={() => copyToClipboard(sunoLanguageIndex.templates.styleField, "Suno style template copied")} className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 font-bold text-white hover:bg-white/20">
                      Copy Style Template
                    </button>
                    <button onClick={() => copyToClipboard(sunoLanguageIndex.templates.lyricsField, "Suno lyrics template copied")} className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 font-bold text-white hover:bg-white/20">
                      Copy Lyrics Template
                    </button>
                  </div>
                </div>
              </Panel>
            )}
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
