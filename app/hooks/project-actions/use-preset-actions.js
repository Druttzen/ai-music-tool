"use client";

import { useCallback } from "react";
import { DEFAULT_STATE, PRESET_KEY, stylePresets } from "../../lib/music-config";
import { safeLocalStorage, storageFailureMessage } from "../../lib/safe-local-storage";

export function usePresetActions(deps) {
  const {
    captureSnapshot,
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
    setInstrumentalVocalFx,
    setMode,
    setMood,
    setPresetName,
    setPromptIntensity,
    setRules,
    setSelectedGenres,
    setSelectedRhythms,
    setSelectedSounds,
    setStatusWithTime,
    setStructure,
    setTempo,
    setVocal,
    structure,
    tempo,
    vocal,
  } = deps;

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

  return { saveCustomPreset, loadPresetObject, deleteCustomPreset, applyPreset };
}
