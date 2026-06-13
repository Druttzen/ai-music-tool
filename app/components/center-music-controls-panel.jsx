"use client";

import { memo } from "react";
import { StylePromptPicker } from "./suno-english-style-prompt-picker";
import { Panel, Pill, SearchablePillGrid } from "./ui-blocks";
import {
  genreOptions,
  rhythmOptions,
  soundOptions,
  vocalOptions,
} from "../lib/music-config";
import {
  SUNO_GENRE_GROUPS,
  SUNO_GENRE_WHEEL_COUNT,
  SUNO_INSTRUMENT_GROUPS,
  SUNO_RHYTHM_GROUPS,
} from "../lib/suno-music-styles";
import { useProjectWorkspace } from "../context/project-workspace-context";

export const CenterMusicControlsPanel = memo(function CenterMusicControlsPanel() {
  const ws = useProjectWorkspace();

  return (
    <Panel
      title="Step 3 — Clickable Music Controls"
      hint={`Suno-aligned genres (${genreOptions.length}), instruments (${soundOptions.length}), and rhythms. Style Prompt Library adds ${SUNO_GENRE_WHEEL_COUNT}+ fusion phrases from the Suno v5.5 genre wheel.`}
    >
      <SearchablePillGrid
        label="Genres"
        hint="Strong Suno genres by family — use Style Prompt Library below for fusion / wheel phrases."
        options={genreOptions}
        groups={SUNO_GENRE_GROUPS}
        selected={ws.selectedGenres}
        onToggle={(x) => ws.toggle(x, ws.selectedGenres, ws.setSelectedGenres)}
      />
      <StylePromptPicker
        selectedGenres={ws.selectedGenres}
        setSelectedGenres={ws.setSelectedGenres}
        rules={ws.rules}
        setRules={ws.setRules}
        setStatusWithTime={ws.setStatusWithTime}
        defaultOpen
      />
      <SearchablePillGrid
        label="Rhythm"
        options={rhythmOptions}
        groups={SUNO_RHYTHM_GROUPS}
        selected={ws.selectedRhythms}
        onToggle={(x) => ws.toggle(x, ws.selectedRhythms, ws.setSelectedRhythms)}
      />
      <SearchablePillGrid
        label="Instruments & textures"
        hint="Core Suno instrument tags plus catalog lines — search e.g. sax, 808, koto."
        options={soundOptions}
        groups={SUNO_INSTRUMENT_GROUPS}
        selected={ws.selectedSounds}
        onToggle={(x) => ws.toggle(x, ws.selectedSounds, ws.setSelectedSounds)}
      />
      <div>
        <div className="mb-2 text-xs font-bold uppercase tracking-wider text-white/45">Vocals</div>
        <div className="flex flex-wrap gap-2">
          {vocalOptions.map((x) => (
            <Pill key={x} active={ws.vocal === x} onClick={() => ws.setVocal(x)}>
              {x}
            </Pill>
          ))}
        </div>
      </div>
    </Panel>
  );
});
