"use client";

import { memo } from "react";
import { Panel, Pill } from "./ui-blocks";
import { FAMOUS_VOICE_PRESETS, formatPublicName } from "../lib/suno-voice-style";
import {
  useProjectWorkspaceActions,
  useProjectWorkspaceProjectState,
  useProjectWorkspacePromptState,
} from "../context/project-workspace-context";

export const CenterVoiceStylePanel = memo(function CenterVoiceStylePanel() {
  const { vocal, voiceRefFirstName, voiceRefLastName } = useProjectWorkspaceProjectState();
  const { voiceStyleCompact } = useProjectWorkspacePromptState();
  const {
    setVoiceRefFirstName,
    setVoiceRefLastName,
    setVoiceStyleLine,
    setStatusWithTime,
    generateVoiceStyleFromNames,
    copyToClipboard,
  } = useProjectWorkspaceActions();

  return (
    <Panel
      title="Suno Voice Style Generator"
      hint="Uses famous artists as stylistic references only (prompt direction — not impersonation or voice cloning). Included in Suno-like prompt when vocals are on."
    >
      <p className="mb-3 text-xs text-white/50">
        Enter a first and last name, pick a quick preset, then generate. Paste the compact line into Suno&apos;s Style
        field; use the lyric tag above your verses in Custom Mode if you want.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <label>
          <div className="mb-1 text-xs font-bold uppercase tracking-wider text-white/45">First name</div>
          <input
            value={voiceRefFirstName}
            onChange={(e) => setVoiceRefFirstName(e.target.value)}
            placeholder="e.g. Freddie"
            className="w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-white outline-none focus:border-cyan-300"
          />
        </label>
        <label>
          <div className="mb-1 text-xs font-bold uppercase tracking-wider text-white/45">Last name</div>
          <input
            value={voiceRefLastName}
            onChange={(e) => setVoiceRefLastName(e.target.value)}
            placeholder="e.g. Mercury (optional)"
            className="w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-white outline-none focus:border-cyan-300"
          />
        </label>
      </div>
      <div className="mt-3">
        <div className="mb-2 text-xs font-bold uppercase tracking-wider text-white/45">Quick presets</div>
        <div className="flex flex-wrap gap-2">
          {FAMOUS_VOICE_PRESETS.map((p, presetIdx) => {
            const label = formatPublicName(p.first, p.last);
            return (
              <Pill
                key={`voice-preset-${presetIdx}-${p.first}-${p.last}`}
                active={false}
                onClick={() => {
                  setVoiceRefFirstName(p.first);
                  setVoiceRefLastName(p.last);
                  setStatusWithTime(`Preset: ${label}`);
                }}
              >
                {label}
              </Pill>
            );
          })}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={generateVoiceStyleFromNames}
          className="rounded-2xl bg-cyan-300 px-4 py-2 text-sm font-bold text-black hover:bg-cyan-200"
        >
          Generate voice style
        </button>
        <button
          type="button"
          onClick={() => {
            setVoiceRefFirstName("");
            setVoiceRefLastName("");
            setVoiceStyleLine("");
            setStatusWithTime("Voice style cleared");
          }}
          className="rounded-2xl border border-white/15 bg-black/30 px-4 py-2 text-sm font-bold text-white hover:bg-white/10"
        >
          Clear
        </button>
      </div>
      {vocal === "Instrumental" && (
        <div className="mt-3 rounded-2xl border border-amber-300/25 bg-amber-300/10 p-3 text-xs text-amber-100">
          Instrumental mode: voice reference is not added to the Suno-like export. Switch vocal preset to hear a lead
          vocal in the prompt.
        </div>
      )}
      {voiceStyleCompact.style ? (
        <div className="mt-3 space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-white/45">Style box</div>
          <pre className="max-h-24 overflow-auto whitespace-pre-wrap rounded-2xl border border-cyan-300/20 bg-black/50 p-3 text-[11px] text-cyan-50">
            {voiceStyleCompact.style}
          </pre>
          <button
            type="button"
            onClick={() => copyToClipboard(voiceStyleCompact.style, "Voice style copied")}
            className="w-full rounded-2xl bg-cyan-300 px-4 py-2 text-sm font-bold text-black hover:bg-cyan-200"
          >
            Copy style line
          </button>
          <div className="text-xs font-bold uppercase tracking-wider text-white/45">Lyric metatag</div>
          <pre className="max-h-20 overflow-auto whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/40 p-3 text-[11px] text-white/80">
            {voiceStyleCompact.lyricTag}
          </pre>
          <button
            type="button"
            onClick={() => copyToClipboard(voiceStyleCompact.lyricTag, "Lyric metatag copied")}
            className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/20"
          >
            Copy lyric metatag
          </button>
        </div>
      ) : null}
    </Panel>
  );
});
