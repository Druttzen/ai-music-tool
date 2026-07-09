"use client";

import { memo } from "react";
import { CenterAnalyzersPanel } from "./center-analyzers-panel";
import {
  CenterCoProducerPanel,
  CenterCoProducerQuickPanel,
} from "./center-co-producer-panel";
import { CenterGuidedPathPanel } from "./center-guided-path-panel";
import { CenterIdeaPanel } from "./center-idea-panel";
import { CenterLyricStylePanel } from "./center-lyric-style-panel";
import { CenterMaestroChatPanel } from "./center-maestro-chat-panel";
import { CenterMoodPanel } from "./center-mood-panel";
import { CenterMusicControlsPanel } from "./center-music-controls-panel";
import { CenterProModePanel } from "./center-pro-mode-panel";
import { CenterStyleDnaSearchPanel } from "./center-style-dna-search-panel";
import { CenterSunoReimportPanel } from "./center-suno-reimport-panel";
import { CenterVariationsPanel } from "./center-variations-panel";
import { CenterVoiceCharacterStudio } from "./center-voice-character-studio";
import { CenterVoiceStylePanel } from "./center-voice-style-panel";

export const PageWorkspaceCenter = memo(function PageWorkspaceCenter() {
  return (
    <section className="space-y-4">
      <CenterGuidedPathPanel />
      <CenterMaestroChatPanel />
      <CenterIdeaPanel />
      <CenterLyricStylePanel />
      <CenterVoiceStylePanel />
      <CenterVoiceCharacterStudio />
      <CenterAnalyzersPanel />
      <CenterStyleDnaSearchPanel />
      <CenterMoodPanel />
      <CenterMusicControlsPanel />
      <CenterCoProducerQuickPanel />
      <CenterCoProducerPanel />
      <CenterSunoReimportPanel />
      <CenterVariationsPanel />
      <CenterProModePanel />
    </section>
  );
});
