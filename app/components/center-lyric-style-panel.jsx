"use client";

import { memo } from "react";
import { CoProducerLyricsBlock } from "./co-producer-lyrics-block";
import { Panel, Slider } from "./ui-blocks";
import { lyricModeOptions, lyricStyleOptions } from "../lib/music-config";
import { SUNO_LYRIC_LANGUAGE_GROUPS } from "../lib/suno-lyric-languages";
import { useProjectWorkspace } from "../context/project-workspace-context";

export const CenterLyricStylePanel = memo(function CenterLyricStylePanel() {
  const ws = useProjectWorkspace();

  return (
    <Panel
      title="Lyric Style Generator"
      hint="Suno-only lyric prompt metadata. Every generated line uses [] so Suno reads it as prompt direction, not lyric text."
    >
      <div className="grid gap-3 md:grid-cols-2">
        <label>
          <div className="mb-1 text-xs font-bold uppercase tracking-wider text-white/45">Lyric Theme</div>
          <input
            value={ws.lyricTheme}
            onChange={(e) => ws.setLyricTheme(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-white outline-none focus:border-orange-300"
          />
        </label>
        <label>
          <div className="mb-1 text-xs font-bold uppercase tracking-wider text-white/45">Lyric Structure</div>
          <input
            value={ws.lyricStructure}
            onChange={(e) => ws.setLyricStructure(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-white outline-none focus:border-orange-300"
          />
        </label>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <label>
          <div className="mb-1 text-xs font-bold uppercase tracking-wider text-white/45">Lyric Style</div>
          <select
            value={ws.lyricStyle}
            onChange={(e) => ws.setLyricStyle(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-white outline-none"
          >
            {lyricStyleOptions.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label>
          <div className="mb-1 text-xs font-bold uppercase tracking-wider text-white/45">Language</div>
          <select
            value={ws.lyricLanguage}
            onChange={(e) => ws.setLyricLanguage(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-white outline-none"
          >
            {SUNO_LYRIC_LANGUAGE_GROUPS.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.languages.map((lang) => (
                  <option key={lang.label} value={lang.label}>
                    {lang.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label>
          <div className="mb-1 text-xs font-bold uppercase tracking-wider text-white/45">Lyric Mode</div>
          <select
            value={ws.lyricMode}
            onChange={(e) => ws.setLyricMode(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-white outline-none"
          >
            {lyricModeOptions.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <Slider
          label="Lyric Density"
          value={ws.lyricDensity}
          left="minimal"
          right="dense"
          setValue={ws.setLyricDensity}
        />
      </div>

      <CoProducerLyricsBlock
        lyricStyle={ws.lyricStyle}
        generatedLyrics={ws.generatedLyrics}
        generatedLyricsStyle={ws.generatedLyricsStyle}
        onLyricsChange={ws.setGeneratedLyrics}
        onGenerate={ws.generateExampleLyrics}
        onAnotherTake={ws.shuffleExampleLyrics}
        generateBusy={ws.lyricsGenerateBusy}
      />

      {ws.generatedLyrics && (
        <button
          type="button"
          onClick={() => ws.copyToClipboard(ws.generatedLyrics, "Generated lyrics copied")}
          className="mt-2 w-full rounded-2xl border border-orange-300/30 bg-black/30 px-4 py-2 text-sm font-bold text-orange-100 hover:bg-black/50"
        >
          Copy Generated Lyrics
        </button>
      )}

      <pre className="mt-3 max-h-52 overflow-auto whitespace-pre-wrap rounded-2xl border border-orange-300/20 bg-black/50 p-4 text-xs leading-relaxed text-orange-50">
        {ws.lyricPrompt}
      </pre>

      <button
        onClick={() => ws.copyToClipboard(ws.lyricPrompt, "Lyric style prompt copied")}
        className="mt-3 w-full rounded-2xl bg-orange-300 px-4 py-2 font-bold text-black hover:bg-orange-200"
      >
        Copy Lyric Style Prompt
      </button>
    </Panel>
  );
});
