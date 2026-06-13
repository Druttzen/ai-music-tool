"use client";

import { useCallback, useMemo, useReducer } from "react";
import { loadCoProducerLlmSettings } from "../lib/co-producer-llm";
import { loadStyleDnaSettings } from "../lib/style-dna-settings";
import {
  PROJECT_PATCH_KEYS,
  createInitialProjectState,
  projectReducer,
} from "../lib/project-state";

function capitalize(key) {
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

  const patch = useCallback((payload) => {
    dispatch({ type: "PATCH", payload });
  }, []);

  const load = useCallback((payload) => {
    dispatch({ type: "LOAD", payload });
  }, []);

  const resetBlank = useCallback(() => {
    dispatch({ type: "RESET_BLANK" });
  }, []);

  const setters = useMemo(() => {
    /** @type {Record<string, (value: unknown) => void>} */
    const out = {};
    for (const key of PROJECT_PATCH_KEYS) {
      out[`set${capitalize(key)}`] = (value) => patch({ [key]: value });
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
