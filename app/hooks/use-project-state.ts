import { useCallback, useMemo, useReducer } from "react";
import { loadCoProducerLlmSettings } from "../lib/co-producer-llm";
import { loadStyleDnaSettings } from "../lib/style-dna-settings";
import {
  PROJECT_PATCH_KEYS,
  createInitialProjectState,
  projectReducer,
} from "../lib/project-state";
import type { ProjectState } from "../lib/project-schema";

type ProjectPatch = Partial<ProjectState> & Record<string, unknown>;

function capitalize(key: string): string {
  return key.charAt(0).toUpperCase() + key.slice(1);
}

/**
 * Central project state via useReducer — replaces dozens of useState hooks in page.jsx.
 */
export function useProjectState() {
  const [state, dispatch] = useReducer(projectReducer, undefined, () =>
    createInitialProjectState(
      typeof window !== "undefined"
        ? {
            coProducerLlmSettings: loadCoProducerLlmSettings(),
            styleDnaSettings: loadStyleDnaSettings(),
          }
        : {},
    ),
  );

  const patch = useCallback((payload: ProjectPatch) => {
    dispatch({ type: "PATCH", payload });
  }, []);

  const load = useCallback((payload: Record<string, unknown>) => {
    dispatch({ type: "LOAD", payload });
  }, []);

  const resetBlank = useCallback(() => {
    dispatch({ type: "RESET_BLANK" });
  }, []);

  const setters = useMemo(() => {
    const out: Record<string, (value: unknown) => void> = {};
    for (const key of PROJECT_PATCH_KEYS) {
      out[`set${capitalize(key)}`] = (value: unknown) => patch({ [key]: value });
    }
    return out;
  }, [patch]);

  return {
    state,
    patch,
    load,
    resetBlank,
    ...state,
    ...setters,
  };
}
