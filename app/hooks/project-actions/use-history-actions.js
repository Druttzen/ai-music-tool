"use client";

import { useCallback } from "react";
import { HISTORY_KEY } from "../../lib/music-config";
import { slimStateForHistory } from "../../lib/project-persistence";
import { safeLocalStorage, storageFailureMessage } from "../../lib/safe-local-storage";

export function useHistoryActions(deps) {
  const {
    avgScore,
    copyToClipboard,
    currentState,
    history,
    loadState,
    prompt,
    setCopied,
    setHistory,
    setSelectedHistoryId,
    setStatusWithTime,
    sunoSlices,
  } = deps;

  const addHistory = useCallback(
    (label, promptText = prompt, state = currentState) => {
      const item = {
        id: Date.now(),
        label,
        time: new Date().toLocaleTimeString(),
        prompt: promptText,
        state: slimStateForHistory(state),
        avgScore,
      };
      const next = [item, ...history].slice(0, 12);
      setHistory(next);
      const result = safeLocalStorage.setJSON(HISTORY_KEY, next);
      if (!result.ok) setStatusWithTime(storageFailureMessage(result), "error");
    },
    [avgScore, currentState, history, prompt, setHistory, setStatusWithTime],
  );

  const copyPrompt = useCallback(async () => {
    const text = sunoSlices
      ? [sunoSlices.style, sunoSlices.lyrics].filter(Boolean).join("\n\n")
      : prompt;
    const ok = await copyToClipboard(text, "Prompt copied");
    if (!ok) return;
    setCopied(true);
    addHistory("Copied prompt");
    setTimeout(() => setCopied(false), 1200);
  }, [addHistory, copyToClipboard, prompt, setCopied, sunoSlices]);

  const restoreHistory = useCallback(
    (item) => {
      loadState(item.state);
      setSelectedHistoryId(item.id);
      const scoreNote = item.avgScore ? ` · score ${item.avgScore}/5` : "";
      setStatusWithTime(`Restored: ${item.label}${scoreNote}`);
    },
    [loadState, setSelectedHistoryId, setStatusWithTime],
  );

  const clearHistory = useCallback(() => {
    setHistory([]);
    safeLocalStorage.remove(HISTORY_KEY);
    setStatusWithTime("History cleared");
  }, [setHistory, setStatusWithTime]);

  return { addHistory, copyPrompt, restoreHistory, clearHistory };
}
