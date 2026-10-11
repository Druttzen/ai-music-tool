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
import { ProjectStateSchema } from "../lib/project-schema";
import { normalizeHistoryEntries, normalizeProjectEntryCollections } from "../lib/project-entries";
import {
  attachCharacterVoiceFieldsToProjectExport,
  extractCharacterVoiceStudioSessionFromProject,
  persistCharacterVoiceStudioSession,
} from "../lib/voice-character-studio-session";
import {
  extractCharacterVoicePresetsFromProject,
  persistCharacterVoicePresets,
} from "../lib/voice-character-preset";
import {
  RESET_WORKSPACES_ON_EXIT_HOOK,
  PROJECT_WORKSPACE_RESET_EVENT,
  clearWorkspaceSessionOnReset,
  consumeWorkspaceResetIfPending,
  resetWorkspacesToDefaultOnExit,
  setSkipWorkspaceAutosave,
  shouldSkipWorkspaceAutosave,
} from "../lib/project-workspace-reset";
import { clearCharacterVoiceStudioSessionOnReset } from "../lib/voice-character-studio-session";
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
  resetBlank,
  setCustomPresets,
  setGuidedStep,
  setHistory,
  setStatusMessage,
  setStatusWithTime,
}) {
  const lastAutosavePayloadRef = useRef("");
  const hydratedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setSkipWorkspaceAutosave(true);
    const t = window.setTimeout(() => {
      void (async () => {
        if (cancelled) return;
        let recoveryFailed = false;
        try {
          const pendingReset = await consumeWorkspaceResetIfPending();
          if (cancelled) return;
          if (pendingReset) {
            resetWorkspacesToDefaultOnExit();
            resetBlank();
            resetAnalyzers();
            patch({ variations: [], guidedStep: 0 });
            lastAutosavePayloadRef.current = "";
            const presets = safeLocalStorage.getJSON(PRESET_KEY, null);
            if (presets) setCustomPresets(presets);
            setStatusWithTime("Workspaces reset to default");
            hydratedRef.current = true;
            setSkipWorkspaceAutosave(false);
            return;
          }
          setSkipWorkspaceAutosave(false);
          const saved = safeLocalStorage.get(STORAGE_KEY, null);
          if (saved) {
            // Until hydration succeeds, never overwrite the only saved copy.
            recoveryFailed = true;
            const raw = JSON.parse(saved);
            const parsed = normalizeProjectEntryCollections(raw);
            // Keep the original autosave recoverable if individual entries were
            // malformed, while still loading the valid project and its entries.
            if (["history", "variations"].some((key) => Array.isArray(raw?.[key]) && raw[key].length !== parsed[key].length)) {
              const recovery = safeLocalStorage.set(`${STORAGE_KEY}_collections_recovery_${Date.now()}`, saved);
              if (!recovery.ok) {
                recoveryFailed = true;
                throw new Error("Could not preserve original project before recovery");
              }
            }
            const validation = ProjectStateSchema.partial().safeParse(parsed);
            if (!validation.success) {
              const recoveryKey = `${STORAGE_KEY}_corrupt_${Date.now()}`;
              const recovery = safeLocalStorage.set(recoveryKey, saved);
              if (!recovery.ok) {
                throw new Error("Could not preserve original project before recovery");
              }
              const removal = safeLocalStorage.remove(STORAGE_KEY);
              if (!removal.ok) throw new Error("Could not clear backed-up invalid project");
              recoveryFailed = false;
              throw new Error("Saved project failed schema validation");
            }
            let hardReset = false;
            if (parsed?.appVersion !== APP_VERSION) {
              if (shouldHardResetProjectOnVersionChange(parsed.appVersion, APP_VERSION)) {
                hardReset = true;
                safeLocalStorage.remove(STORAGE_KEY);
                resetBlank();
                resetAnalyzers();
                clearCharacterVoiceStudioSessionOnReset();
                clearWorkspaceSessionOnReset();
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
            if (!hardReset) {
              const cvPresets = extractCharacterVoicePresetsFromProject(parsed);
              if (cvPresets !== null) {
                persistCharacterVoicePresets(cvPresets, { merge: false });
              }
              const cvSession = extractCharacterVoiceStudioSessionFromProject(parsed);
              if (cvSession !== null) {
                persistCharacterVoiceStudioSession(cvSession);
              }
            }
            recoveryFailed = false;
          }
          const presets = safeLocalStorage.getJSON(PRESET_KEY, null);
          if (presets) setCustomPresets(presets);
          const hist = safeLocalStorage.getJSON(HISTORY_KEY, null);
          if (Array.isArray(hist)) {
            const entries = normalizeHistoryEntries(hist);
            if (entries.length !== hist.length) {
              const recovery = safeLocalStorage.setJSON(`${HISTORY_KEY}_recovery_${Date.now()}`, hist);
              if (!recovery.ok) {
                recoveryFailed = true;
                throw new Error("Could not preserve original history before recovery");
              }
            }
            setHistory(entries);
          }
        } catch {
          setStatusWithTime("Could not load saved data", "error");
        } finally {
          hydratedRef.current = !recoveryFailed;
          setSkipWorkspaceAutosave(recoveryFailed);
        }
      })();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [loadState, patch, resetAnalyzers, resetBlank, setCustomPresets, setHistory, setStatusWithTime]);

  useEffect(() => {
    let idleId = null;
    let fallbackId = null;
    const persist = () => {
      if (!hydratedRef.current || shouldSkipWorkspaceAutosave()) return;
      try {
        const payload = JSON.stringify(
          attachCharacterVoiceFieldsToProjectExport(slimStateForPersistence(currentState)),
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
    };
    const scheduleIdlePersist = () => {
      if (typeof window.requestIdleCallback === "function") {
        idleId = window.requestIdleCallback(persist, { timeout: 1000 });
      } else {
        fallbackId = window.setTimeout(persist, 0);
      }
    };
    const timeoutId = window.setTimeout(scheduleIdlePersist, 2000);
    return () => {
      window.clearTimeout(timeoutId);
      if (idleId !== null && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
      if (fallbackId !== null) window.clearTimeout(fallbackId);
    };
  }, [currentState, setStatusMessage, setStatusWithTime]);

  useEffect(() => {
    if (promptEngine === "Suno-like") return;
    const t = window.setTimeout(() => {
      setGuidedStep(0);
    }, 0);
    return () => window.clearTimeout(t);
  }, [promptEngine, setGuidedStep]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    // Retain the explicit legacy reset hook. Native exit now arms a restore flag.
    // Do not bind pagehide/beforeunload:
    // Playwright reloads and Next HMR would wipe the project as if the app exited.
    const onExit = () => resetWorkspacesToDefaultOnExit();
    const onExplicitReset = (event) => {
      if (!event.detail?.resumeAutosave) return;
      hydratedRef.current = true;
      lastAutosavePayloadRef.current = "";
      setSkipWorkspaceAutosave(false);
    };
    window[RESET_WORKSPACES_ON_EXIT_HOOK] = onExit;
    window.addEventListener(PROJECT_WORKSPACE_RESET_EVENT, onExplicitReset);
    return () => {
      window.removeEventListener(PROJECT_WORKSPACE_RESET_EVENT, onExplicitReset);
      if (window[RESET_WORKSPACES_ON_EXIT_HOOK] === onExit) {
        delete window[RESET_WORKSPACES_ON_EXIT_HOOK];
      }
    };
  }, []);

  return { lastAutosavePayloadRef };
}
