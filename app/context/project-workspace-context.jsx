"use client";

import { createContext, useContext } from "react";

/** @type {React.Context<Record<string, unknown> | null>} */
export const ProjectWorkspaceActionsContext = createContext(null);

/** @type {React.Context<Record<string, unknown> | null>} */
export const ProjectWorkspaceProjectStateContext = createContext(null);

/** @type {React.Context<Record<string, unknown> | null>} */
export const ProjectWorkspaceAnalyzerStateContext = createContext(null);

/** @type {React.Context<Record<string, unknown> | null>} */
export const ProjectWorkspacePromptStateContext = createContext(null);

function useSliceContext(context, label) {
  const ctx = useContext(context);
  if (!ctx) {
    throw new Error(`${label} must be used within ProjectWorkspaceProviders`);
  }
  return ctx;
}

export function useProjectWorkspaceActions() {
  return useSliceContext(ProjectWorkspaceActionsContext, "useProjectWorkspaceActions");
}

export function useProjectWorkspaceProjectState() {
  return useSliceContext(
    ProjectWorkspaceProjectStateContext,
    "useProjectWorkspaceProjectState",
  );
}

export function useProjectWorkspaceAnalyzerState() {
  return useSliceContext(
    ProjectWorkspaceAnalyzerStateContext,
    "useProjectWorkspaceAnalyzerState",
  );
}

export function useProjectWorkspacePromptState() {
  return useSliceContext(ProjectWorkspacePromptStateContext, "useProjectWorkspacePromptState");
}

/**
 * Subscribe to all workspace slices — re-renders on any slice change.
 * Prefer the slice hooks above in memoized panels.
 */
export function useProjectWorkspace() {
  const actions = useProjectWorkspaceActions();
  const projectState = useProjectWorkspaceProjectState();
  const analyzerState = useProjectWorkspaceAnalyzerState();
  const promptState = useProjectWorkspacePromptState();
  return { ...actions, ...projectState, ...analyzerState, ...promptState };
}

/**
 * @param {{ actions: Record<string, unknown>, projectState: Record<string, unknown>, analyzerState: Record<string, unknown>, promptState: Record<string, unknown> }} slices
 * @param {React.ReactNode} children
 */
export function ProjectWorkspaceProviders({ slices, children }) {
  return (
    <ProjectWorkspaceActionsContext.Provider value={slices.actions}>
      <ProjectWorkspaceProjectStateContext.Provider value={slices.projectState}>
        <ProjectWorkspaceAnalyzerStateContext.Provider value={slices.analyzerState}>
          <ProjectWorkspacePromptStateContext.Provider value={slices.promptState}>
            {children}
          </ProjectWorkspacePromptStateContext.Provider>
        </ProjectWorkspaceAnalyzerStateContext.Provider>
      </ProjectWorkspaceProjectStateContext.Provider>
    </ProjectWorkspaceActionsContext.Provider>
  );
}
