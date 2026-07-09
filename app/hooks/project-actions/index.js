"use client";

import { usePresetActions } from "./use-preset-actions";
import { useExportActions } from "./use-export-actions";
import { useHistoryActions } from "./use-history-actions";
import { useSunoActions } from "./use-suno-actions";
import { useLyricsActions } from "./use-lyrics-actions";
import { useCoProducerActions } from "./use-co-producer-actions";
import { useVoiceActions } from "./use-voice-actions";
import { useResetActions } from "./use-reset-actions";
import { useToggleList } from "./_shared";

/**
 * Composes domain-scoped project action hooks (presets, export, history, lyrics, …).
 */
export function useProjectActions(deps) {
  const toggle = useToggleList();
  const preset = usePresetActions(deps);
  const exportActions = useExportActions(deps);
  const history = useHistoryActions(deps);
  const suno = useSunoActions(deps);
  const lyrics = useLyricsActions({ ...deps, addHistory: history.addHistory });
  const coProducer = useCoProducerActions({ ...deps, addHistory: history.addHistory });
  const voice = useVoiceActions(deps);
  const reset = useResetActions(deps);

  return {
    toggle,
    ...preset,
    ...exportActions,
    ...history,
    ...suno,
    ...lyrics,
    ...coProducer,
    ...voice,
    ...reset,
  };
}
