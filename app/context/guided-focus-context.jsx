"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { isGuidedPanelVisible } from "../lib/suno-guided-step-focus";
import {
  useProjectWorkspaceProjectState,
} from "./project-workspace-context";

export const GUIDED_FOCUS_SHOW_ALL_KEY = "ai_music_creator_guided_show_all";

function readShowAllPreference() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(GUIDED_FOCUS_SHOW_ALL_KEY) === "1";
  } catch {
    return false;
  }
}

/** @type {React.Context<{ showAll: boolean, setShowAll: (v: boolean) => void, isVisible: (panelId: string, column: "center"|"left"|"right") => boolean, focused: boolean } | null>} */
const GuidedFocusContext = createContext(null);

export function GuidedFocusProvider({ children }) {
  const { guidedStep, promptEngine } = useProjectWorkspaceProjectState();
  const [showAll, setShowAllState] = useState(() => readShowAllPreference());

  const setShowAll = useCallback((value) => {
    setShowAllState((prev) => {
      const next = typeof value === "function" ? value(prev) : value;
      try {
        if (next) window.localStorage.setItem(GUIDED_FOCUS_SHOW_ALL_KEY, "1");
        else window.localStorage.removeItem(GUIDED_FOCUS_SHOW_ALL_KEY);
      } catch {
        /* ignore quota / privacy mode */
      }
      return next;
    });
  }, []);

  const focused = promptEngine === "Suno-like" && !showAll;

  const isVisible = useCallback(
    (panelId, column) => isGuidedPanelVisible(panelId, column, guidedStep, promptEngine, showAll),
    [guidedStep, promptEngine, showAll],
  );

  const value = useMemo(
    () => ({
      showAll,
      setShowAll,
      isVisible,
      focused,
      guidedStep,
      promptEngine,
    }),
    [showAll, isVisible, focused, guidedStep, promptEngine, setShowAll],
  );

  return <GuidedFocusContext.Provider value={value}>{children}</GuidedFocusContext.Provider>;
}

export function useGuidedFocus() {
  const ctx = useContext(GuidedFocusContext);
  if (!ctx) {
    throw new Error("useGuidedFocus must be used within GuidedFocusProvider");
  }
  return ctx;
}
