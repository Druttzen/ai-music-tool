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
import { CenterSectionDawLite } from "./center-section-daw-lite";
import { CenterMaestroChatPanel } from "./center-maestro-chat-panel";
import { CenterMoodPanel } from "./center-mood-panel";
import { CenterMusicControlsPanel } from "./center-music-controls-panel";
import { CenterProModePanel } from "./center-pro-mode-panel";
import { CenterStyleDnaSearchPanel } from "./center-style-dna-search-panel";
import { CenterSunoReimportPanel } from "./center-suno-reimport-panel";
import { CenterVariationsPanel } from "./center-variations-panel";
import { CenterSunoProToolsPanel } from "./center-suno-pro-tools-panel";
import { CenterVoiceCharacterStudio } from "./center-voice-character-studio";
import { CenterVocalEmbedStudio } from "./center-vocal-embed-studio";
import { CenterVoiceStylePanel } from "./center-voice-style-panel";
import { GuidedFocusPanel } from "./guided-focus-panel";
import { GUIDED_PANEL_IDS } from "../lib/suno-guided-step-focus";
import { useGuidedFocus } from "../context/guided-focus-context";

export const PageWorkspaceCenter = memo(function PageWorkspaceCenter() {
  const { focused } = useGuidedFocus();

  return (
    <section className="space-y-4">
      {focused ? (
        <p className="rounded-2xl border border-violet-400/25 bg-violet-500/10 px-3 py-2 text-[11px] leading-relaxed text-violet-100/90">
          <span className="font-bold text-violet-50">Focused step mode</span> — only tools for your
          current Suno path step are shown. Use <span className="text-white/75">Show all tools</span>{" "}
          in the coach banner if you need the full studio.
        </p>
      ) : null}

      <GuidedFocusPanel panelId={GUIDED_PANEL_IDS.guidedPath} column="center">
        <CenterGuidedPathPanel />
      </GuidedFocusPanel>
      <GuidedFocusPanel panelId={GUIDED_PANEL_IDS.maestro} column="center">
        <CenterMaestroChatPanel />
      </GuidedFocusPanel>
      <GuidedFocusPanel panelId={GUIDED_PANEL_IDS.idea} column="center">
        <CenterIdeaPanel />
      </GuidedFocusPanel>
      <GuidedFocusPanel panelId={GUIDED_PANEL_IDS.lyricStyle} column="center">
        <CenterLyricStylePanel />
        <CenterSectionDawLite />
      </GuidedFocusPanel>
      <GuidedFocusPanel panelId={GUIDED_PANEL_IDS.voiceStyle} column="center">
        <CenterVoiceStylePanel />
      </GuidedFocusPanel>
      <GuidedFocusPanel panelId={GUIDED_PANEL_IDS.voiceCharacter} column="center">
        <CenterVoiceCharacterStudio />
      </GuidedFocusPanel>
      <GuidedFocusPanel panelId={GUIDED_PANEL_IDS.vocalEmbed} column="center">
        <CenterVocalEmbedStudio />
      </GuidedFocusPanel>
      <GuidedFocusPanel panelId={GUIDED_PANEL_IDS.analyzers} column="center">
        <CenterAnalyzersPanel />
      </GuidedFocusPanel>
      <GuidedFocusPanel panelId={GUIDED_PANEL_IDS.styleDna} column="center">
        <CenterStyleDnaSearchPanel />
      </GuidedFocusPanel>
      <GuidedFocusPanel panelId={GUIDED_PANEL_IDS.mood} column="center">
        <CenterMoodPanel />
      </GuidedFocusPanel>
      <GuidedFocusPanel panelId={GUIDED_PANEL_IDS.musicControls} column="center">
        <CenterMusicControlsPanel />
      </GuidedFocusPanel>
      <GuidedFocusPanel panelId={GUIDED_PANEL_IDS.coProducerQuick} column="center">
        <CenterCoProducerQuickPanel />
      </GuidedFocusPanel>
      <GuidedFocusPanel panelId={GUIDED_PANEL_IDS.coProducer} column="center">
        <CenterCoProducerPanel />
      </GuidedFocusPanel>
      <GuidedFocusPanel panelId={GUIDED_PANEL_IDS.sunoReimport} column="center">
        <CenterSunoReimportPanel />
      </GuidedFocusPanel>
      <GuidedFocusPanel panelId={GUIDED_PANEL_IDS.variations} column="center">
        <CenterVariationsPanel />
        <CenterSunoProToolsPanel />
      </GuidedFocusPanel>
      <GuidedFocusPanel panelId={GUIDED_PANEL_IDS.proMode} column="center">
        <CenterProModePanel />
      </GuidedFocusPanel>
    </section>
  );
});
