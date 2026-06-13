"use client";

import { createContext, useContext } from "react";

/** @type {React.Context<Record<string, unknown> | null>} */
export const ProjectWorkspaceContext = createContext(null);

export function useProjectWorkspace() {
  const ctx = useContext(ProjectWorkspaceContext);
  if (!ctx) {
    throw new Error("useProjectWorkspace must be used within ProjectWorkspaceContext");
  }
  return ctx;
}
