"use client";

import { createContext, useContext, type ReactNode } from "react";

type WorkspaceSlice = Record<string, unknown>;

export const ProjectWorkspaceActionsContext = createContext<WorkspaceSlice | null>(null);
export const ProjectWorkspaceProjectStateContext = createContext<WorkspaceSlice | null>(null);
export const ProjectWorkspaceAnalyzerStateContext = createContext<WorkspaceSlice | null>(null);
export const ProjectWorkspacePromptStateContext = createContext<WorkspaceSlice | null>(null);

function useSliceContext(context: React.Context<WorkspaceSlice | null>, label: string) {
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

/** Subscribe to all workspace slices — re-renders on any slice change. */
export function useProjectWorkspace() {
  const actions = useProjectWorkspaceActions();
  const projectState = useProjectWorkspaceProjectState();
  const analyzerState = useProjectWorkspaceAnalyzerState();
  const promptState = useProjectWorkspacePromptState();
  return { ...actions, ...projectState, ...analyzerState, ...promptState };
}

type WorkspaceSlices = {
  actions: WorkspaceSlice;
  projectState: WorkspaceSlice;
  analyzerState: WorkspaceSlice;
  promptState: WorkspaceSlice;
};

export function ProjectWorkspaceProviders({
  slices,
  children,
}: {
  slices: WorkspaceSlices;
  children: ReactNode;
}) {
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
