"use client";

import { useEffect, useRef } from "react";
import {
  APP_VERSION,
  HISTORY_KEY,
  PRESET_KEY,
  STORAGE_KEY,
} from "../lib/music-config";
import {
  migratePersistedProject,
  shouldHardResetProjectOnVersionChange,
  slimStateForPersistence,
} from "../lib/project-persistence";
import {
  attachCharacterVoicePresetsToProjectExport,
  extractCharacterVoicePresetsFromProject,
  persistCharacterVoicePresets,
} from "../lib/voice-character-preset";
import { safeLocalStorage, storageFailureMessage } from "../lib/safe-local-storage";

/**
 * Hydrates project/presets/history from localStorage and debounced autosave.
 */
export function useProjectPersistence({
  currentState,
  loadState,
  patch,
  promptEngine,
  resetAnalyzers,
  setCustomPresets,
  setGuidedStep,
  setHistory,
  setStatusMessage,
  setStatusWithTime,
}) {
  const lastAutosavePayloadRef = useRef("");

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
          const cvPresets = extractCharacterVoicePresetsFromProject(parsed);
          if (cvPresets !== null) {
            persistCharacterVoicePresets(cvPresets, { merge: false });
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
        const payload = JSON.stringify(
          attachCharacterVoicePresetsToProjectExport(slimStateForPersistence(currentState)),
        );
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

  return { lastAutosavePayloadRef };
}
