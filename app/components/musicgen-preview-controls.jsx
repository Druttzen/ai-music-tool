"use client";

import { memo, useState } from "react";

/**
 * Shared MusicGen prompt + duration controls.
 * @param {{ defaultPrompt?: string, busy?: boolean, available?: boolean, installHint?: string, canUseMelodyReference?: boolean, canUseHighlightMelody?: boolean, onGenerate?: (prompt: string, durationSec: number, options?: { attach?: boolean, download?: boolean, mergeAfterGenerate?: boolean, useMelodyReference?: boolean, useHighlightMelody?: boolean }) => void, compact?: boolean }} props
 */
export const MusicGenPreviewControls = memo(function MusicGenPreviewControls({
  defaultPrompt = "",
  busy = false,
  available = false,
  installHint = "npm run sidecar:generate",
  canUseMelodyReference = false,
  canUseHighlightMelody = false,
  onGenerate,
  compact = false,
}) {
  const [promptOverride, setPromptOverride] = useState(null);
  const [durationSec, setDurationSec] = useState(10);
  const [mergeAfterGenerate, setMergeAfterGenerate] = useState(true);
  const [useMelodyReference, setUseMelodyReference] = useState(false);
  const [useHighlightMelody, setUseHighlightMelody] = useState(false);
  const prompt = promptOverride ?? defaultPrompt ?? "";

  if (!onGenerate) return null;

  const genOptions = (extra = {}) => ({
    mergeAfterGenerate,
    useMelodyReference: canUseMelodyReference && useMelodyReference,
    useHighlightMelody:
      canUseMelodyReference && useMelodyReference && canUseHighlightMelody && useHighlightMelody,
    ...extra,
  });

  return (
    <section
      className={`rounded-2xl border border-violet-400/25 bg-violet-500/10 space-y-2 ${
        compact ? "p-2" : "p-3"
      }`}
    >
      <div className="text-[10px] font-bold uppercase tracking-wider text-violet-100/90">
        MusicGen preview
      </div>
      <p className="text-[10px] leading-relaxed text-white/45">
        Short WAV sketch from your project style (
        <code className="text-white/60">{installHint}</code>
        ). Loads in the waveform player — CC-BY-NC weights, preview only.
      </p>
      <label className="block text-[10px] text-white/50">
        Prompt
        <textarea
          value={prompt}
          onChange={(e) => setPromptOverride(e.target.value)}
          rows={compact ? 2 : 3}
          placeholder="Electronic, 128 bpm, dark mood…"
          className="mt-1 w-full resize-y rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-xs text-white outline-none focus:border-violet-400/50"
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
          {[5, 10, 15, 20, 30].map((sec) => (
            <option key={sec} value={sec}>
              {sec}s
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-[10px] text-white/55">
        <input
          type="checkbox"
          checked={mergeAfterGenerate}
          disabled={busy}
          onChange={(e) => setMergeAfterGenerate(e.target.checked)}
        />
        Merge into Suno fields after generate
      </label>
      {canUseMelodyReference ? (
        <label className="flex items-center gap-2 text-[10px] text-white/55">
          <input
            type="checkbox"
            checked={useMelodyReference}
            disabled={busy}
            onChange={(e) => setUseMelodyReference(e.target.checked)}
          />
          Condition on current track audio (melody mode)
        </label>
      ) : null}
      {canUseMelodyReference && canUseHighlightMelody ? (
        <label className="flex items-center gap-2 text-[10px] text-white/55">
          <input
            type="checkbox"
            checked={useHighlightMelody}
            disabled={busy || !useMelodyReference}
            onChange={(e) => setUseHighlightMelody(e.target.checked)}
          />
          Use waveform highlight region only
        </label>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !available}
          onClick={(e) => {
            e.preventDefault();
            onGenerate(prompt, durationSec, { attach: true, ...genOptions() });
          }}
          className="min-w-[140px] flex-1 rounded-xl border border-violet-400/35 bg-violet-500/20 py-2 text-xs font-bold text-violet-50 hover:bg-violet-500/30 disabled:opacity-50"
        >
          {busy ? "Generating…" : available ? "Generate & play" : "MusicGen not available"}
        </button>
        <button
          type="button"
          disabled={busy || !available}
          onClick={(e) => {
            e.preventDefault();
            onGenerate(prompt, durationSec, { attach: false, download: true, ...genOptions() });
          }}
          className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-[10px] font-semibold text-white/70 hover:text-white disabled:opacity-50"
        >
          Download only
        </button>
      </div>
    </section>
  );
});
