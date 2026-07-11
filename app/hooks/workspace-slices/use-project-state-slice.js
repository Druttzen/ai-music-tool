"use client";

import { useMemo } from "react";
import { buildProjectWorkspaceProjectState } from "../../lib/project-workspace-value";

const PROJECT_KEYS = [
  "coProducerLlmSettings",
  "coProducerOutput",
  "copied",
  "customPresets",
  "generatedHooks",
  "generatedHooksStyle",
  "generatedLyrics",
  "generatedLyricsStyle",
  "guidedStep",
  "history",
  "idea",
  "instrumentalVocalFx",
  "lyricDensity",
  "lyricLanguage",
  "lyricMode",
  "lyricStructure",
  "lyricStyle",
  "lyricTheme",
  "lyricsGenerateBusy",
  "mode",
  "mood",
  "notes",
  "presetName",
  "proMode",
  "promptEngine",
  "promptFormat",
  "promptIntensity",
  "rules",
  "scores",
  "albumRoles",
  "selectedGenres",
  "selectedHistoryId",
  "selectedRhythms",
  "selectedSounds",
  "structure",
  "styleDnaSettings",
  "sunoPasteActive",
  "sunoPasteLyrics",
  "sunoPasteStyle",
  "tempo",
  "variationCount",
  "variations",
  "vocal",
  "voiceRefFirstName",
  "voiceRefLastName",
  "voiceStyleLine",
];

export function useWorkspaceProjectStateSlice(source) {
  return useMemo(
    () => buildProjectWorkspaceProjectState(pick(source, PROJECT_KEYS)),
    [source],
  );
}

function pick(source, keys) {
  const out = {};
  for (const k of keys) out[k] = source[k];
  return out;
}
