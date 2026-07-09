"use client";

import { memo } from "react";
import { useGuidedFocus } from "../context/guided-focus-context";

/**
 * Hides panels that are not relevant to the current Suno guided step.
 * @param {{ panelId: string, column: "center"|"left"|"right", children: React.ReactNode }} props
 */
export const GuidedFocusPanel = memo(function GuidedFocusPanel({ panelId, column, children }) {
  const { isVisible, focused } = useGuidedFocus();
  if (!isVisible(panelId, column)) return null;

  if (!focused) return children;

  return (
    <div data-guided-panel={panelId} className="guided-focus-panel">
      {children}
    </div>
  );
});
