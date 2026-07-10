"use client";

import { useCallback } from "react";
import {
  buildCoProducerAdvisoryReport,
  buildCoProducerQuickTweakPatch,
} from "../../lib/co-producer-engine";
import { generateCoProducerAdvisoryWithLlm } from "../../lib/co-producer-advisory-llm";
import { isCoProducerLlmReady } from "../../lib/co-producer-llm";
import { uniq } from "../../lib/music-helpers";

export function useCoProducerActions(deps) {
  const {
    addHistory,
    audioAnalysis,
    captureSnapshot,
    coProducerLlmSettings,
    currentState,
    idea,
    intensityText,
    imageAnalysis,
    lyricPrompt,
    mode,
    mood,
    moodWords,
    patch,
    prompt,
    rules,
    selectedGenres,
    selectedRhythms,
    selectedSounds,
    setCoProducerOutput,
    setNotes,
    setStatusWithTime,
    setVariations,
    sidecarGenerateAvailable,
    structure,
    tempo,
    variationCount,
    vocal,
    vocalText,
  } = deps;

  const coProducer = useCallback(
    (action) => {
      patch(buildCoProducerQuickTweakPatch(action));
      setStatusWithTime(action);
    },
    [patch, setStatusWithTime],
  );

  const buildCoProducerAI = useCallback(async () => {
    const advisoryInput = {
      selectedGenres,
      selectedSounds,
      selectedRhythms,
      mood,
      moodWords,
      tempo,
      vocal,
      lyricTheme: deps.lyricTheme,
      promptIntensity: deps.promptIntensity,
      mode,
      idea,
      musicGenAvailable: !!sidecarGenerateAvailable,
      audioAnalysis,
    };

    let output;
    let coPatch;
    let source = "heuristic";

    if (isCoProducerLlmReady(coProducerLlmSettings)) {
      try {
        const llm = await generateCoProducerAdvisoryWithLlm(advisoryInput, coProducerLlmSettings);
        output = llm.output;
        coPatch = llm.patch;
        source = llm.source;
      } catch (err) {
        setStatusWithTime(
          `Co-Producer LLM unavailable — using offline engine (${String(err?.message || "error").slice(0, 60)})`,
          "warning",
        );
      }
    }

    if (!output) {
      const heuristic = buildCoProducerAdvisoryReport(advisoryInput);
      output = heuristic.output;
      coPatch = heuristic.patch;
    }

    patch(coPatch);
    setCoProducerOutput(output);
    setNotes(output);
    addHistory("Co-Producer AI report", output, currentState);
    setStatusWithTime(
      source === "llm" ? "Co-Producer AI (LLM) updated prompt" : "Co-Producer AI updated prompt",
    );
  }, [
    addHistory,
    audioAnalysis,
    coProducerLlmSettings,
    currentState,
    deps.lyricTheme,
    deps.promptIntensity,
    idea,
    mode,
    mood,
    moodWords,
    patch,
    selectedGenres,
    selectedRhythms,
    selectedSounds,
    setCoProducerOutput,
    setNotes,
    setStatusWithTime,
    sidecarGenerateAvailable,
    tempo,
    vocal,
  ]);

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

  return { coProducer, buildCoProducerAI, generateVariations };
}
