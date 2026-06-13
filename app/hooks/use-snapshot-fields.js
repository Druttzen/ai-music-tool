"use client";

import { useMemo } from "react";
import { pickSnapshotFields } from "../lib/project-state";

/**
 * Memoized snapshot field bundle for autosave / undo (project reducer state + analyzer refs).
 * @param {Record<string, unknown>} state
 * @param {{ audioAnalysis: unknown, imageAnalysis: unknown }} analyzers
 */
export function useSnapshotFields(state, { audioAnalysis, imageAnalysis }) {
  return useMemo(
    () => pickSnapshotFields({ ...state, audioAnalysis, imageAnalysis }),
    [state, audioAnalysis, imageAnalysis],
  );
}
