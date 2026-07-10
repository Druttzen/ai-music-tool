"use client";

import { useMemo } from "react";
import { buildProjectWorkspacePromptState } from "../../lib/project-workspace-value";

const PROMPT_KEYS = [
  "intensityText",
  "lyricPrompt",
  "prompt",
  "sourcePrompt",
  "sunoBuiltFieldSlices",
  "sunoFieldSlices",
  "sunoGuidedInput",
  "sunoSlices",
  "sunoWarnings",
  "voiceStyleCompact",
];

export function useWorkspacePromptStateSlice(source) {
  return useMemo(
    () => buildProjectWorkspacePromptState(pick(source, PROMPT_KEYS)),
    [source],
  );
}

function pick(source, keys) {
  const out = {};
  for (const k of keys) out[k] = source[k];
  return out;
}
