"use client";

import { useCallback } from "react";
import { HISTORY_KEY, STORAGE_KEY } from "../../lib/music-config";
import { clearCharacterVoiceStudioSessionOnReset } from "../../lib/voice-character-studio-session";
import { clearWorkspaceSessionOnReset } from "../../lib/project-workspace-reset";
import { safeLocalStorage } from "../../lib/safe-local-storage";

export function useResetActions(deps) {
  const {
    captureSnapshot,
    lastAutosavePayloadRef,
    resetAnalyzers,
    resetBlank,
    resetSplash,
    setStatusWithTime,
  } = deps;

  const resetAll = useCallback(() => {
    captureSnapshot("before reset");
    resetBlank();
    resetAnalyzers();
    clearCharacterVoiceStudioSessionOnReset();
    clearWorkspaceSessionOnReset();
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

  return { resetAll };
}
