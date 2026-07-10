"use client";

import { useWorkspaceActionsSlice } from "./workspace-slices/use-actions-slice";
import { useWorkspaceAnalyzerStateSlice } from "./workspace-slices/use-analyzer-state-slice";
import { useWorkspaceProjectStateSlice } from "./workspace-slices/use-project-state-slice";
import { useWorkspacePromptStateSlice } from "./workspace-slices/use-prompt-state-slice";

/**
 * Memoized ProjectWorkspaceContext slices — actions stay stable while volatile
 * state (project / analyzer / prompt) updates independently.
 * @param {Record<string, unknown>} source
 */
export function useWorkspaceValue(source) {
  const actions = useWorkspaceActionsSlice(source);
  const projectState = useWorkspaceProjectStateSlice(source);
  const analyzerState = useWorkspaceAnalyzerStateSlice(source);
  const promptState = useWorkspacePromptStateSlice(source);

  return { actions, projectState, analyzerState, promptState };
}
