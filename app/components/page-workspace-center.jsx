"use client";

import dynamic from "next/dynamic";
import { memo } from "react";
import { Panel } from "./ui-blocks";
import { GuidedFocusPanel } from "./guided-focus-panel";
import { GUIDED_PANEL_IDS } from "../lib/suno-guided-step-focus";
import { useGuidedFocus } from "../context/guided-focus-context";

/**
 * Lazy-load a center panel with a Panel-shaped loading fallback so Playwright
 * heading locators still match while the chunk loads.
 * @param {() => Promise<{ default: import("react").ComponentType }>} loader
 * @param {string} title
 * @param {string} [hint]
 */
function lazyCenter(loader, title, hint = "Loading…") {
  return dynamic(loader, {
    ssr: false,
    loading: () => (
      <Panel title={title} hint={hint}>
        <p className="text-xs text-white/45">Loading panel…</p>
      </Panel>
    ),
  });
}

const CenterGuidedPathPanel = lazyCenter(
  () =>
    import("./center-guided-path-panel").then((mod) => ({
      default: mod.CenterGuidedPathPanel,
    })),
  "Suno — guided path",
);
const CenterMaestroChatPanel = lazyCenter(
  () =>
    import("./center-maestro-chat-panel").then((mod) => ({
      default: mod.CenterMaestroChatPanel,
    })),
  "Maestro — AI Chat Music Creator",
);
const CenterIdeaPanel = lazyCenter(
  () =>
    import("./center-idea-panel").then((mod) => ({
      default: mod.CenterIdeaPanel,
    })),
  "Step 1 — Idea Input",
);
const CenterLyricStylePanel = lazyCenter(
  () =>
    import("./center-lyric-style-panel").then((mod) => ({
      default: mod.CenterLyricStylePanel,
    })),
  "Lyric Style Generator",
);
const CenterSectionDawLite = lazyCenter(
  () =>
    import("./center-section-daw-lite").then((mod) => ({
      default: mod.CenterSectionDawLite,
    })),
  "Section DAW (lite)",
);
const CenterVoiceStylePanel = lazyCenter(
  () =>
    import("./center-voice-style-panel").then((mod) => ({
      default: mod.CenterVoiceStylePanel,
    })),
  "Suno Voice Style Generator",
);
const CenterVoiceCharacterStudio = lazyCenter(
  () =>
    import("./center-voice-character-studio").then((mod) => ({
      default: mod.CenterVoiceCharacterStudio,
    })),
  "Voice Character Studio",
);
const CenterVocalEmbedStudio = lazyCenter(
  () =>
    import("./center-vocal-embed-studio").then((mod) => ({
      default: mod.CenterVocalEmbedStudio,
    })),
  "Vocal Embed Studio",
);
const CenterAnalyzersPanel = lazyCenter(
  () =>
    import("./center-analyzers-panel").then((mod) => ({
      default: mod.CenterAnalyzersPanel,
    })),
  "Drag & Drop Analyzers",
);
const CenterCoverToolsPanel = lazyCenter(
  () =>
    import("./center-cover-tools-panel").then((mod) => ({
      default: mod.CenterCoverToolsPanel,
    })),
  "Album Cover",
);
const CenterStyleDnaSearchPanel = lazyCenter(
  () =>
    import("./center-style-dna-search-panel").then((mod) => ({
      default: mod.CenterStyleDnaSearchPanel,
    })),
  "Style-DNA Search",
);
const CenterMoodPanel = lazyCenter(
  () =>
    import("./center-mood-panel").then((mod) => ({
      default: mod.CenterMoodPanel,
    })),
  "Step 2 — Mood Sliders",
);
const CenterMusicControlsPanel = lazyCenter(
  () =>
    import("./center-music-controls-panel").then((mod) => ({
      default: mod.CenterMusicControlsPanel,
    })),
  "Step 3 — Clickable Music Controls",
);
const CenterCoProducerQuickPanel = lazyCenter(
  () =>
    import("./center-co-producer-panel").then((mod) => ({
      default: mod.CenterCoProducerQuickPanel,
    })),
  "Step 4 — Co‑Producer Buttons",
);
const CenterCoProducerPanel = lazyCenter(
  () =>
    import("./center-co-producer-panel").then((mod) => ({
      default: mod.CenterCoProducerPanel,
    })),
  "Co‑Producer AI",
);
const CenterSunoReimportPanel = lazyCenter(
  () =>
    import("./center-suno-reimport-panel").then((mod) => ({
      default: mod.CenterSunoReimportPanel,
    })),
  "Suno Re-import",
);
const CenterVariationsPanel = lazyCenter(
  () =>
    import("./center-variations-panel").then((mod) => ({
      default: mod.CenterVariationsPanel,
    })),
  "Variation Engine",
);
const CenterSunoProToolsPanel = lazyCenter(
  () =>
    import("./center-suno-pro-tools-panel").then((mod) => ({
      default: mod.CenterSunoProToolsPanel,
    })),
  "Suno 5.5 Pro tools",
);
const CenterProModePanel = lazyCenter(
  () =>
    import("./center-pro-mode-panel").then((mod) => ({
      default: mod.CenterProModePanel,
    })),
  "Advanced Override",
);

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
        <CenterCoverToolsPanel />
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
