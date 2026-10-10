"use client";

import { memo, useState } from "react";
import { useWorkspaceResetEffect } from "../hooks/use-workspace-reset-effect";

/**
 * Shared MusicGen prompt + duration controls.
 * @param {{ defaultPrompt?: string, busy?: boolean, canCancel?: boolean, cancelRequested?: boolean, onCancel?: () => void, available?: boolean, installHint?: string, canUseMelodyReference?: boolean, canUseHighlightMelody?: boolean, onGenerate?: (prompt: string, durationSec: number, options?: object) => void, compact?: boolean }} props
 */
export const MusicGenPreviewControls = memo(function MusicGenPreviewControls({
  defaultPrompt = "",
  lastTake,
  busy = false,
  canCancel = false,
  cancelRequested = false,
  onCancel,
  available = false,
  installHint = "npm run sidecar:generate",
  canUseMelodyReference = false,
  canUseHighlightMelody = false,
  onGenerate,
  compact = false,
}) {
  const [promptOverride, setPromptOverride] = useState(lastTake?.prompt ?? null);
  const [durationSec, setDurationSec] = useState(lastTake?.durationSec ?? 30);
  const previousPreset = String(lastTake?.model || "").replace("facebook/musicgen-", "");
  const [modelPreset, setModelPreset] = useState(["small", "medium", "stereo-small", "stereo-medium"].includes(previousPreset) ? previousPreset : "stereo-small");
  const [mergeAfterGenerate, setMergeAfterGenerate] = useState(false);
  const [useMelodyReference, setUseMelodyReference] = useState(false);
  const [useHighlightMelody, setUseHighlightMelody] = useState(false);
  const [temperature, setTemperature] = useState(lastTake?.temperature ?? 1);
  const [cfgCoef, setCfgCoef] = useState(lastTake?.cfgCoef ?? 3);
  const [topK, setTopK] = useState(lastTake?.topK ?? 250);
  const [topP, setTopP] = useState(lastTake?.topP ?? 0);
  const [seed, setSeed] = useState(lastTake?.seed == null ? "" : String(lastTake.seed));

  useWorkspaceResetEffect(() => {
    setPromptOverride(null);
    setDurationSec(30);
    setModelPreset("stereo-small");
    setMergeAfterGenerate(false);
    setUseMelodyReference(false);
    setUseHighlightMelody(false);
    setTemperature(1);
    setCfgCoef(3);
    setTopK(250);
    setTopP(0);
    setSeed("");
  });

  const prompt = promptOverride ?? defaultPrompt ?? "";

  if (!onGenerate) return null;

  const genOptions = (extra = {}) => ({
    mergeAfterGenerate,
    useMelodyReference: canUseMelodyReference && useMelodyReference,
    useHighlightMelody:
      canUseMelodyReference && useMelodyReference && canUseHighlightMelody && useHighlightMelody,
    temperature,
    model: modelPreset,
    cfgCoef,
    topK,
    topP,
    ...(seed.trim() ? { seed: Number(seed) } : {}),
    ...extra,
  });

  return (
    <section
      className={`rounded-2xl border border-violet-400/25 bg-violet-500/10 space-y-2 ${
        compact ? "p-2" : "p-3"
      }`}
    >
      <div className="text-[10px] font-bold uppercase tracking-wider text-violet-100/90">
        MusicGen · offline draft for Suno
      </div>
      <p className="text-[10px] leading-relaxed text-white/45">
        Audition the groove and instruments locally, then export your chosen WAV for Suno.
        Stereo models keep their stereo image. Models download on first use; cached models run locally.
        MusicGen makes instrumental drafts and does not reproduce Suno vocals. CC-BY-NC weights.
      </p>
      {!available ? <p className="text-[10px] text-white/50">Setup: {installHint}</p> : null}
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
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-[10px] text-white/50">
          Temperature
          <input type="number" min="0.1" max="2" step="0.1" value={temperature} disabled={busy}
            onChange={(e) => setTemperature(Number(e.target.value) || 1)}
            className="mt-1 w-full rounded-lg border border-white/15 bg-black/35 p-1.5 text-xs text-white" />
        </label>
        <label className="block text-[10px] text-white/50">
          Guidance
          <input type="number" min="0" max="10" step="0.5" value={cfgCoef} disabled={busy}
            onChange={(e) => setCfgCoef(Number(e.target.value) || 0)}
            className="mt-1 w-full rounded-lg border border-white/15 bg-black/35 p-1.5 text-xs text-white" />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-[10px] text-white/50">
          Top-k
          <input type="number" min="0" max="500" step="10" value={topK} disabled={busy}
            onChange={(e) => setTopK(Number(e.target.value) || 0)}
            className="mt-1 w-full rounded-lg border border-white/15 bg-black/35 p-1.5 text-xs text-white" />
        </label>
        <label className="block text-[10px] text-white/50">
          Top-p (0 = off)
          <input type="number" min="0" max="1" step="0.05" value={topP} disabled={busy}
            onChange={(e) => setTopP(Number(e.target.value) || 0)}
            className="mt-1 w-full rounded-lg border border-white/15 bg-black/35 p-1.5 text-xs text-white" />
        </label>
      </div>
      <label className="block text-[10px] text-white/50">
        Seed (optional, reproducible)
        <input type="number" min="0" max="2147483647" value={seed} disabled={busy}
          onChange={(e) => setSeed(e.target.value)}
          placeholder="Random"
          className="mt-1 w-full rounded-lg border border-white/15 bg-black/35 p-1.5 text-xs text-white" />
      </label>
      <label className="block text-[10px] text-white/50">
        Model
        <select
          value={modelPreset}
          disabled={busy}
          onChange={(e) => setModelPreset(e.target.value)}
          className="mt-1 w-full rounded-lg border border-white/15 bg-black/35 p-1.5 text-xs text-white"
        >
          <option value="stereo-small">Stereo draft (fast)</option>
          <option value="stereo-medium">Stereo detail (slower; 16 GB GPU recommended)</option>
          <option value="small">Small mono</option>
          <option value="medium">Medium mono (slower; 16 GB GPU recommended)</option>
        </select>
      </label>
      <p className="text-[10px] text-white/45">
        Melody mode uses a larger melody model. Keep the seed fixed while refining a prompt;
        change it to explore another take. A larger model is never silently replaced with Small.
      </p>
      <label className="block text-[10px] text-white/50">
        Duration
        <select
          value={durationSec}
          disabled={busy}
          onChange={(e) => setDurationSec(Number(e.target.value))}
          className="mt-1 w-full rounded-lg border border-white/15 bg-black/35 p-1.5 text-xs text-white"
        >
          {[5, 8, 10, 15, 20, 30].map((sec) => (
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
        Replace project style with the analyzed result
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
        {busy && canCancel && onCancel ? (
          <button
            type="button"
            disabled={cancelRequested}
            onClick={(e) => {
              e.preventDefault();
              void onCancel();
            }}
            className="rounded-xl border border-rose-400/35 bg-rose-500/10 px-3 py-2 text-[10px] font-semibold text-rose-100 hover:bg-rose-500/20 disabled:opacity-50"
          >
            {cancelRequested ? "Cancel requested…" : "Cancel generation"}
          </button>
        ) : null}
      </div>
      {cancelRequested ? (
        <p role="status" className="text-[10px] text-amber-100/75">
          Cancellation requested. Current inference may finish safely before it stops.
        </p>
      ) : null}
    </section>
  );
});
