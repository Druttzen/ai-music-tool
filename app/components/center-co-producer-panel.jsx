"use client";

import { memo } from "react";
import {
  CoProducerHooksBlock,
  CoProducerLlmSettings,
  CoProducerLyricsBlock,
} from "./co-producer-lyrics-block";
import { Panel } from "./ui-blocks";
import { fixes, promptFormatOptions } from "../lib/music-config";
import { saveCoProducerLlmSettings } from "../lib/co-producer-llm";
import { getLyricStyleDirection } from "../lib/lyric-generator";
import { buildMoodWords } from "../lib/music-helpers";
import { buildMusicGenPrompt } from "../lib/musicgen-prompt";
import {
  useProjectWorkspaceActions,
  useProjectWorkspaceAnalyzerState,
  useProjectWorkspaceProjectState,
} from "../context/project-workspace-context";

const CO_PRODUCER_DIRECTIONS = [
  "Make darker",
  "More aggressive",
  "More minimal",
  "More cinematic",
  "More club",
];

export const CenterCoProducerQuickPanel = memo(function CenterCoProducerQuickPanel() {
  const { idea, mood, selectedGenres, selectedSounds, selectedRhythms, tempo } =
    useProjectWorkspaceProjectState();
  const { sidecarGenerateAvailable } = useProjectWorkspaceAnalyzerState();
  const { coProducer, generateMusicFromPrompt } = useProjectWorkspaceActions();

  const musicGenPrompt = buildMusicGenPrompt({
    selectedGenres,
    selectedSounds,
    selectedRhythms,
    tempo,
    idea,
    moodWords: buildMoodWords(mood),
  });

  return (
    <Panel title="Step 4 — Co‑Producer Buttons" hint="One-click creative direction.">
      <div className="flex flex-wrap gap-2">
        {CO_PRODUCER_DIRECTIONS.map((x) => (
          <button
            key={x}
            onClick={() => coProducer(x)}
            className="rounded-2xl bg-white px-4 py-2 text-sm font-bold text-black hover:bg-cyan-100"
          >
            {x}
          </button>
        ))}
        {sidecarGenerateAvailable ? (
          <button
            type="button"
            onClick={() => generateMusicFromPrompt(musicGenPrompt, 10, { attach: true })}
            className="rounded-2xl border border-violet-400/40 bg-violet-500/20 px-4 py-2 text-sm font-bold text-violet-50 hover:bg-violet-500/30"
          >
            MusicGen sketch
          </button>
        ) : null}
      </div>
    </Panel>
  );
});

export const CenterCoProducerPanel = memo(function CenterCoProducerPanel() {
  const {
    lyricStyle,
    coProducerLlmSettings,
    promptFormat,
    promptEngine,
    coProducerOutput,
    generatedHooks,
    generatedHooksStyle,
    generatedLyrics,
    generatedLyricsStyle,
    lyricsGenerateBusy,
  } = useProjectWorkspaceProjectState();
  const {
    buildCoProducerAI,
    generateHooks,
    applyQuickFix,
    setCoProducerLlmSettings,
    setStatusWithTime,
    setPromptFormat,
    setPromptEngine,
    setGeneratedLyrics,
    generateExampleLyrics,
    shuffleExampleLyrics,
    copyToClipboard,
  } = useProjectWorkspaceActions();

  return (
    <Panel
      title="Co‑Producer AI"
      hint="Improve Prompt analyzes balance and gaps; quick fixes append rule lines. Hooks and lyrics follow your Lyric Style."
    >
      <p className="mb-3 text-[11px] leading-relaxed text-white/50">
        <strong className="text-white/65">Copy guide:</strong> Lyric Style Generator = bracketed Suno direction only.
        <strong className="text-white/65"> Generate Lyrics</strong> writes draft lyric text matched to{" "}
        <strong className="text-white/65">{lyricStyle}</strong> ({getLyricStyleDirection(lyricStyle)}). Raw Prompt
        = bracketed direction; Structured Song / Performance Ready = [Verse]/[Chorus] drafts.
      </p>
      <div className="grid gap-2 md:grid-cols-3">
        <button
          onClick={buildCoProducerAI}
          className="rounded-2xl bg-emerald-300 px-4 py-2 font-bold text-black hover:bg-emerald-200"
        >
          Improve Prompt
        </button>
        <button
          onClick={() => generateHooks()}
          className="rounded-2xl bg-cyan-300 px-4 py-2 font-bold text-black hover:bg-cyan-200"
        >
          Generate Hooks
        </button>
        <button
          onClick={() => generateHooks(true)}
          className="rounded-2xl border border-cyan-300/40 bg-black/30 px-4 py-2 font-bold text-cyan-100 hover:bg-black/50"
        >
          Another hook take
        </button>
      </div>

      <div className="mt-3">
        <div className="mb-2 text-xs font-bold uppercase tracking-wider text-white/45">Quick rule fixes</div>
        <div className="flex flex-wrap gap-2">
          {Object.keys(fixes).map((label) => (
            <button
              key={label}
              type="button"
              title={fixes[label]}
              onClick={() => applyQuickFix(label)}
              className="rounded-2xl border border-amber-300/30 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-100 hover:bg-amber-500/20"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <CoProducerLlmSettings
        settings={coProducerLlmSettings}
        onChange={setCoProducerLlmSettings}
        onSave={() => {
          saveCoProducerLlmSettings(coProducerLlmSettings);
          setStatusWithTime("LLM settings saved locally");
        }}
      />

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <label>
          <div className="mb-1 text-xs font-bold uppercase tracking-wider text-white/45">Prompt Format</div>
          <select
            value={promptFormat}
            onChange={(e) => setPromptFormat(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-white outline-none"
          >
            {promptFormatOptions.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label>
          <div className="mb-1 text-xs font-bold uppercase tracking-wider text-white/45">Prompt Engine</div>
          <select
            value={promptEngine}
            onChange={(e) => setPromptEngine(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-white outline-none"
          >
            <option>Standard</option>
            <option>Suno-like</option>
          </select>
        </label>
      </div>

      {coProducerOutput && (
        <pre className="mt-3 max-h-52 overflow-auto whitespace-pre-wrap rounded-2xl border border-emerald-300/20 bg-black/50 p-4 text-xs leading-relaxed text-emerald-50">
          {coProducerOutput}
        </pre>
      )}

      <CoProducerHooksBlock
        lyricStyle={lyricStyle}
        generatedHooks={generatedHooks}
        generatedHooksStyle={generatedHooksStyle}
      />

      <CoProducerLyricsBlock
        className="mt-3"
        lyricStyle={lyricStyle}
        generatedLyrics={generatedLyrics}
        generatedLyricsStyle={generatedLyricsStyle}
        onLyricsChange={setGeneratedLyrics}
        onGenerate={generateExampleLyrics}
        onAnotherTake={shuffleExampleLyrics}
        generateBusy={lyricsGenerateBusy}
        showStyleHint={false}
      />

      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <button
          onClick={() => copyToClipboard(coProducerOutput || "", "Report copied")}
          className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/20"
        >
          Copy Report
        </button>
        <button
          onClick={() => copyToClipboard(generatedHooks || "", "Hooks copied")}
          className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/20"
        >
          Copy Hooks
        </button>
        <button
          onClick={() => copyToClipboard(generatedLyrics || "", "Lyrics copied")}
          className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/20"
        >
          Copy Lyrics
        </button>
      </div>
    </Panel>
  );
});
