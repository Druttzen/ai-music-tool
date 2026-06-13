"use client";

import { memo, useState } from "react";
import { DropBox, Panel, Pill } from "./ui-blocks";
import { SUPPORTED_AUDIO_ACCEPT, SUPPORTED_AUDIO_LABEL } from "../lib/analyzer-file-types";
import { VOICE_CHARACTER_DISCLAIMER } from "../lib/voice-character-preset";
import { VOICE_CHARACTER_STUDIO_PANEL_ID } from "../lib/voice-character-handoff";
import { useCharacterVoiceStudio } from "../hooks/use-character-voice-studio";
import { useProjectWorkspace } from "../context/project-workspace-context";

export const CenterVoiceCharacterStudio = memo(function CenterVoiceCharacterStudio() {
  const ws = useProjectWorkspace();
  const studio = useCharacterVoiceStudio();
  const [youtubeDraft, setYoutubeDraft] = useState("");
  const youtubeInputValue = studio.youtubeReference?.watchUrl ?? youtubeDraft;

  const handleLoadPreset = (name) => {
    studio.loadCharacterPreset(name);
    if (!studio.characterPresets[name]?.source?.youtubeUrl) {
      setYoutubeDraft("");
    }
  };

  const handleClearStudio = () => {
    studio.clearStudio();
    setYoutubeDraft("");
  };

  return (
    <div id={VOICE_CHARACTER_STUDIO_PANEL_ID}>
    <Panel
      title="Voice Character Studio"
      hint="Optional Polish-step tool — analyze vocal structure from audio (acapella best), map traits to Suno Style + lyric metatag, save character presets, regenerate the voice block."
    >
      <p className="mb-3 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-100/95">
        {VOICE_CHARACTER_DISCLAIMER}
      </p>

      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <label className="block">
          <div className="mb-1 text-xs font-bold uppercase tracking-wider text-white/45">
            YouTube reference (metadata only)
          </div>
          <input
            value={youtubeInputValue}
            onChange={(e) => setYoutubeDraft(e.target.value)}
            readOnly={Boolean(studio.youtubeReference)}
            placeholder="https://www.youtube.com/watch?v=…"
            className="w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-sm text-white outline-none focus:border-cyan-300 read-only:opacity-80"
          />
        </label>
        <button
          type="button"
          disabled={studio.busy || !youtubeInputValue.trim() || Boolean(studio.youtubeReference)}
          onClick={() => studio.linkYoutubeReference(youtubeInputValue)}
          className="self-end rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-xs font-bold text-white hover:bg-white/15 disabled:opacity-40"
        >
          Link YouTube
        </button>
      </div>
      {studio.youtubeReference ? (
        <p className="mt-2 text-[11px] text-cyan-100/90">
          Linked: {studio.youtubeReference.title || studio.youtubeReference.videoId} — export vocal audio locally,
          then drop below.
        </p>
      ) : null}

      <div className="mt-4">
        <DropBox
          title="Drop vocal reference audio"
          hint={`${SUPPORTED_AUDIO_LABEL} — acapella or isolated lead works best`}
          accept={SUPPORTED_AUDIO_ACCEPT}
          onFile={(file) => studio.analyzeVoiceFile(file)}
        >
          {studio.voiceAnalysis ? (
            <div className="mt-3 space-y-2 text-left text-xs text-white/75">
              <div className="font-bold text-cyan-200">{studio.voiceAnalysis.characterLabel}</div>
              <div className="font-mono text-[10px] text-white/50">{studio.voiceAnalysis.summary}</div>
              <div className="flex flex-wrap gap-2">
                {studio.voiceAnalysis.textureTags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-white/10 bg-black/40 px-2 py-0.5 text-[10px] text-cyan-100"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </DropBox>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          disabled={!Object.keys(studio.characterPresets).length}
          onClick={studio.exportCharacterPresets}
          className="rounded-2xl bg-emerald-300 px-4 py-2.5 text-sm font-bold text-black hover:bg-emerald-200 disabled:opacity-40"
        >
          Export character presets JSON
        </button>
        <label className="cursor-pointer rounded-2xl bg-white px-4 py-2.5 text-center text-sm font-bold text-black hover:bg-cyan-100">
          Import character presets JSON
          <input
            type="file"
            accept="application/json"
            onChange={studio.importCharacterPresets}
            className="hidden"
          />
        </label>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label>
          <div className="mb-1 text-xs font-bold uppercase tracking-wider text-white/45">Character preset name</div>
          <input
            value={studio.presetName}
            onChange={(e) => studio.setPresetName(e.target.value)}
            placeholder="e.g. Warm baritone narrator"
            className="w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-white outline-none focus:border-fuchsia-300"
          />
        </label>
        <div className="flex flex-wrap items-end gap-2">
          <button
            type="button"
            disabled={studio.busy || !studio.voiceAnalysis}
            onClick={studio.saveCharacterPreset}
            className="rounded-2xl bg-fuchsia-300 px-4 py-2.5 text-sm font-bold text-black hover:bg-fuchsia-200 disabled:opacity-40"
          >
            Save character preset
          </button>
          <button
            type="button"
            disabled={studio.busy || (!studio.voiceAnalysis && !Object.keys(studio.characterPresets).length)}
            onClick={() => studio.regenerateCharacterVoice(studio.presetName.trim())}
            className="rounded-2xl bg-cyan-300 px-4 py-2.5 text-sm font-bold text-black hover:bg-cyan-200 disabled:opacity-40"
          >
            Regenerate Suno voice block
          </button>
        </div>
      </div>

      {Object.keys(studio.characterPresets).length > 0 ? (
        <div className="mt-4 space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-white/45">Saved character presets</div>
          {Object.entries(studio.characterPresets).map(([name, preset]) => (
            <div
              key={preset.id || name}
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-black/30 p-3"
            >
              <div>
                <div className="text-sm font-bold text-fuchsia-100">{name}</div>
                <div className="text-[10px] text-white/45">{preset.analysis?.characterLabel}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Pill active={false} onClick={() => handleLoadPreset(name)}>
                  Load
                </Pill>
                <Pill active={false} onClick={() => studio.regenerateCharacterVoice(name)}>
                  Regenerate
                </Pill>
                <button
                  type="button"
                  onClick={() => studio.deleteCharacterPreset(name)}
                  className="text-xs font-bold text-red-300 hover:text-red-200"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {ws.voiceStyleLine ? (
        <div className="mt-4 space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-white/45">Generated Suno voice block</div>
          <pre className="max-h-36 overflow-auto whitespace-pre-wrap rounded-2xl border border-cyan-300/20 bg-black/50 p-3 text-[11px] text-cyan-50">
            {ws.voiceStyleLine}
          </pre>
          <button
            type="button"
            onClick={() => ws.copyToClipboard(ws.voiceStyleLine, "Character voice Style line copied")}
            className="w-full rounded-2xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-sm font-bold text-cyan-100 hover:bg-cyan-300/20"
          >
            Copy character Style line
          </button>
        </div>
      ) : null}

      {studio.voiceStyleCompact.style ? (
        <div className="mt-4 space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-white/45">Compact (Style box)</div>
          <pre className="max-h-24 overflow-auto whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/40 p-3 text-[11px] text-white/80">
            {studio.voiceStyleCompact.style}
          </pre>
          <button
            type="button"
            onClick={() => ws.copyToClipboard(studio.voiceStyleCompact.style, "Character compact style copied")}
            className="w-full rounded-2xl bg-white px-4 py-2 text-sm font-bold text-black hover:bg-cyan-100"
          >
            Copy compact style line
          </button>
          <div className="text-xs font-bold uppercase tracking-wider text-white/45">Lyric metatag (optional)</div>
          <pre className="max-h-20 overflow-auto whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/40 p-3 text-[11px] text-white/80">
            {studio.voiceStyleCompact.lyricTag}
          </pre>
          <button
            type="button"
            onClick={() => ws.copyToClipboard(studio.voiceStyleCompact.lyricTag, "Character lyric metatag copied")}
            className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/20"
          >
            Copy lyric metatag
          </button>
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleClearStudio}
        className="mt-3 text-xs font-bold text-white/45 hover:text-white/70"
      >
        Clear studio session
      </button>
    </Panel>
    </div>
  );
});
