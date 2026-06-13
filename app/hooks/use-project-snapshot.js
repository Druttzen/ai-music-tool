"use client";

import { useCallback, useMemo } from "react";
import { buildProjectSnapshot } from "../lib/project-state";
import {
  extractCharacterVoiceStudioSessionFromProject,
  persistCharacterVoiceStudioSession,
} from "../lib/voice-character-studio-session";
import {
  extractCharacterVoicePresetsFromProject,
  persistCharacterVoicePresets,
} from "../lib/voice-character-preset";
import { useProjectPersistence } from "./use-project-persistence";
import { useUndoSnapshot } from "./use-undo-snapshot";

/**
 * Autosave / undo snapshot wiring: build snapshot from live fields, hydrate analyzers on load.
 */
export function useProjectSnapshot({
  appVersion,
  snapshotFields,
  loadProjectState,
  setAudioAnalysis,
  clearAudioAnalysis,
  setImageAnalysis,
  clearImageAnalysis,
  resetAnalyzers,
  patch,
  promptEngine,
  setCustomPresets,
  setGuidedStep,
  setHistory,
  setStatusMessage,
  setStatusWithTime,
}) {
  const currentState = useMemo(
    () => buildProjectSnapshot(appVersion, snapshotFields),
    [appVersion, snapshotFields],
  );

  const loadState = useCallback(
    (data) => {
      loadProjectState(data);
      if (data.audioAnalysis) setAudioAnalysis(data.audioAnalysis);
      else clearAudioAnalysis();
      if (data.imageAnalysis) setImageAnalysis(data.imageAnalysis);
      else clearImageAnalysis();
      const cvPresets = extractCharacterVoicePresetsFromProject(data);
      if (cvPresets !== null) {
        persistCharacterVoicePresets(cvPresets, { merge: false });
      }
      const cvSession = extractCharacterVoiceStudioSessionFromProject(data);
      if (cvSession !== null) {
        persistCharacterVoiceStudioSession(cvSession);
      }
    },
    [clearAudioAnalysis, clearImageAnalysis, loadProjectState, setAudioAnalysis, setImageAnalysis],
  );

  const { captureSnapshot, revertSnapshot } = useUndoSnapshot(
    () => currentState,
    loadState,
    setStatusWithTime,
  );

  const { lastAutosavePayloadRef } = useProjectPersistence({
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
  });

  return {
    captureSnapshot,
    currentState,
    lastAutosavePayloadRef,
    loadState,
    revertSnapshot,
  };
}
