"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { isGuidedPanelVisible } from "../lib/suno-guided-step-focus";
import {
  useProjectWorkspaceProjectState,
} from "./project-workspace-context";

/** @type {React.Context<{ showAll: boolean, setShowAll: (v: boolean) => void, isVisible: (panelId: string, column: "center"|"left"|"right") => boolean, focused: boolean } | null>} */
const GuidedFocusContext = createContext(null);

export function GuidedFocusProvider({ children }) {
  const { guidedStep, promptEngine } = useProjectWorkspaceProjectState();
  const [showAll, setShowAll] = useState(false);

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
    [showAll, isVisible, focused, guidedStep, promptEngine],
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
