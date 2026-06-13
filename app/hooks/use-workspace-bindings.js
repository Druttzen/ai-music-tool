"use client";

import {
  pickProjectActionInput,
  pickWorkspaceContextExtras,
} from "../lib/workspace-bindings-input";
import { useProjectActions } from "./use-project-actions";
import { useWorkspaceValue } from "./use-workspace-value";

/**
 * Wires project actions + memoized workspace context from shared binding pickers.
 */
export function useWorkspaceBindings({
  projectState,
  analyzers,
  pipeline,
  snapshot,
  avgScore,
  copyToClipboard,
  resetSplash,
  setStatusWithTime,
}) {
  const externals = { avgScore, copyToClipboard, resetSplash, setStatusWithTime };
  const actions = useProjectActions(
    pickProjectActionInput(projectState, analyzers, pipeline, snapshot, externals),
  );

  return useWorkspaceValue({
    ...actions,
    ...pickWorkspaceContextExtras(projectState, analyzers, pipeline, snapshot, externals),
    copyToClipboard,
  });
}
