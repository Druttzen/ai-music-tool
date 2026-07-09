"use client";

import { useCallback } from "react";
import { toggleListItem } from "../../lib/music-helpers";
import { pickVoiceStyleCompactForCoProducer } from "../../lib/voice-character-studio-session";

/** Shared voice fields for co-producer lyric/hook generation. */
export function useCoProducerVoiceFields(deps) {
  const { voiceStyleLine, voiceStyleCompact } = deps;
  return useCallback(
    () => ({
      voiceStyleLine,
      voiceStyleCompact: pickVoiceStyleCompactForCoProducer(voiceStyleCompact),
    }),
    [voiceStyleLine, voiceStyleCompact],
  );
}

export function useToggleList() {
  return useCallback((item, list, setter) => setter(toggleListItem(item, list)), []);
}
