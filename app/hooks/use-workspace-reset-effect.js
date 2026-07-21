"use client";

import { useEffect } from "react";
import { PROJECT_WORKSPACE_RESET_EVENT } from "../lib/project-workspace-reset";

/**
 * Run a callback when Reset to Default (or other workspace reset) fires.
 * @param {() => void} onReset
 * @param {unknown[]} [deps]
 */
export function useWorkspaceResetEffect(onReset, deps = []) {
  useEffect(() => {
    const handler = () => onReset();
    window.addEventListener(PROJECT_WORKSPACE_RESET_EVENT, handler);
    return () => window.removeEventListener(PROJECT_WORKSPACE_RESET_EVENT, handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller controls deps like useEffect
  }, deps);
}
