"use client";

import { memo, useState } from "react";
import { useWorkspaceResetEffect } from "../hooks/use-workspace-reset-effect";

/**
 * ACE-Step full-song controls (requires AIMC_ACESTEP_API_URL).
 * @param {{ defaultPrompt?: string, defaultLyrics?: string, busy?: boolean, available?: boolean, installHint?: string, onGenerate?: (prompt: string, options?: { lyrics?: string, durationSec?: number, attach?: boolean, download?: boolean }) => void, compact?: boolean }} props
 */
export const AceStepSongControls = memo(function AceStepSongControls({
  defaultPrompt = "",
  defaultLyrics = "",
  busy = false,
  available = false,
  installHint = "Set AIMC_ACESTEP_API_URL (see docs/acestep.md)",
  onGenerate,
  compact = false,
}) {
  const [promptOverride, setPromptOverride] = useState(null);
  const [lyricsOverride, setLyricsOverride] = useState(null);
  const [durationSec, setDurationSec] = useState(60);

  useWorkspaceResetEffect(() => {
    setPromptOverride(null);
    setLyricsOverride(null);
    setDurationSec(60);
  });

  const prompt = promptOverride ?? defaultPrompt ?? "";
  const lyrics = lyricsOverride ?? defaultLyrics ?? "";

  if (!onGenerate) return null;

  return (
    <section
      className={`rounded-2xl border border-emerald-400/25 bg-emerald-500/10 space-y-2 ${
        compact ? "p-2" : "p-3"
      }`}
    >
      <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-100/90">
        ACE-Step full song
      </div>
      <p className="text-[10px] leading-relaxed text-white/45">
        Local full-song generation via ACE-Step API (
        <code className="text-white/60">{installHint}</code>
        ). MIT weights — longer than MusicGen previews.
      </p>
      <label className="block text-[10px] text-white/50">
        Prompt
        <textarea
          value={prompt}
          onChange={(e) => setPromptOverride(e.target.value)}
          rows={compact ? 2 : 3}
          placeholder="Upbeat pop, bright guitars, summer energy…"
          className="mt-1 w-full resize-y rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-xs text-white outline-none focus:border-emerald-400/50"
        />
      </label>
      <label className="block text-[10px] text-white/50">
        Lyrics (optional)
        <textarea
          value={lyrics}
          onChange={(e) => setLyricsOverride(e.target.value)}
          rows={compact ? 2 : 4}
          placeholder="[Verse]&#10;…"
          className="mt-1 w-full resize-y rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-xs text-white outline-none focus:border-emerald-400/50"
        />
      </label>
      <label className="block text-[10px] text-white/50">
        Duration
        <select
          value={durationSec}
          disabled={busy}
          onChange={(e) => setDurationSec(Number(e.target.value))}
          className="mt-1 w-full rounded-lg border border-white/15 bg-black/35 p-1.5 text-xs text-white"
        >
          {[30, 60, 90, 120, 180].map((sec) => (
            <option key={sec} value={sec}>
              {sec}s
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !available}
          onClick={(e) => {
            e.preventDefault();
            onGenerate(prompt, { lyrics, durationSec, attach: true });
          }}
          className="min-w-[140px] flex-1 rounded-xl border border-emerald-400/35 bg-emerald-500/20 py-2 text-xs font-bold text-emerald-50 hover:bg-emerald-500/30 disabled:opacity-50"
        >
          {busy ? "Generating…" : available ? "Generate full song" : "ACE-Step not configured"}
        </button>
        <button
          type="button"
          disabled={busy || !available}
          onClick={(e) => {
            e.preventDefault();
            onGenerate(prompt, { lyrics, durationSec, attach: false, download: true });
          }}
          className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-[10px] font-semibold text-white/70 hover:text-white disabled:opacity-50"
        >
          Download only
        </button>
      </div>
    </section>
  );
});
