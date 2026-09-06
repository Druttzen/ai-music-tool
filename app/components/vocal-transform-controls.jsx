"use client";

import { memo, useState } from "react";
import { useWorkspaceResetEffect } from "../hooks/use-workspace-reset-effect";
import { hasMeaningfulHighlightRange } from "../lib/audio-highlight-slice";

/**
 * Transform vocal regions on the current analyzer mix.
 * @param {{ analysis?: object|null, busy?: boolean, available?: boolean, rvcAvailable?: boolean, melbandAvailable?: boolean, installHint?: string, onTransform?: (options: { mode: string, pitchSemitones: number, regionScope: "highlight"|"all"|"full", downloadVocals: boolean }) => void }} props
 */
export const VocalTransformControls = memo(function VocalTransformControls({
  analysis = null,
  busy = false,
  available = false,
  rvcAvailable = false,
  melbandAvailable = false,
  installHint = "npm run sidecar:stems",
  onTransform,
}) {
  const [mode, setMode] = useState("pitch");
  const [pitchSemitones, setPitchSemitones] = useState(2);
  const [regionScope, setRegionScope] = useState("highlight");
  const [downloadVocals, setDownloadVocals] = useState(true);

  useWorkspaceResetEffect(() => {
    setMode("pitch");
    setPitchSemitones(2);
    setRegionScope("highlight");
    setDownloadVocals(true);
  });

  if (!onTransform || !analysis) return null;

  const canHighlight = hasMeaningfulHighlightRange(analysis);
  const extraRegions = Array.isArray(analysis.vocalRegions) ? analysis.vocalRegions.length : 0;
  const modes = [
    { id: "pitch", label: "Pitch shift" },
    { id: "formant", label: "Formant" },
    { id: "robot", label: "Robot" },
    { id: "rvc", label: rvcAvailable ? "RVC voice" : "RVC (not ready)", disabled: !rvcAvailable },
  ];

  return (
    <section className="rounded-2xl border border-amber-400/25 bg-amber-500/10 space-y-2 p-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-amber-100/90">
        Vocal region transform
      </div>
      <p className="text-[10px] leading-relaxed text-white/45">
        Separates vocals ({melbandAvailable ? "Mel-Band preferred when installed" : "Demucs / Mel-Band"}),
        rewrites selected regions, then exports remix + optional acapella (
        <code className="text-white/60">{installHint}</code>
        ).
      </p>
      {melbandAvailable ? (
        <p className="text-[10px] text-emerald-200/70">
          Mel-Band RoFormer available — vocal-transform will use 2-stem separation automatically.
        </p>
      ) : null}
      <label className="block text-[10px] text-white/50">
        Mode
        <select
          value={mode}
          disabled={busy}
          onChange={(e) => setMode(e.target.value)}
          className="mt-1 w-full rounded-lg border border-white/15 bg-black/35 p-1.5 text-xs text-white"
        >
          {modes.map((m) => (
            <option key={m.id} value={m.id} disabled={m.disabled}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      {mode === "pitch" || mode === "formant" || mode === "rvc" ? (
        <label className="block text-[10px] text-white/50">
          Pitch (semitones)
          <input
            type="number"
            step="1"
            value={pitchSemitones}
            disabled={busy}
            onChange={(e) => setPitchSemitones(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-white/15 bg-black/35 p-1.5 text-xs text-white"
          />
        </label>
      ) : null}
      <label className="block text-[10px] text-white/50">
        Regions
        <select
          value={regionScope}
          disabled={busy}
          onChange={(e) => setRegionScope(e.target.value)}
          className="mt-1 w-full rounded-lg border border-white/15 bg-black/35 p-1.5 text-xs text-white"
        >
          <option value="highlight" disabled={!canHighlight}>
            Highlight only{canHighlight ? "" : " (mark a range first)"}
          </option>
          <option value="all" disabled={!canHighlight && extraRegions === 0}>
            All marked regions ({1 + extraRegions})
          </option>
          <option value="full">Whole track</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-[10px] text-white/55">
        <input
          type="checkbox"
          checked={downloadVocals}
          disabled={busy}
          onChange={(e) => setDownloadVocals(e.target.checked)}
        />
        Also download parallel acapella
      </label>
      <button
        type="button"
        disabled={busy || !available || (mode === "rvc" && !rvcAvailable)}
        onClick={(e) => {
          e.preventDefault();
          onTransform({
            mode,
            pitchSemitones,
            regionScope:
              regionScope === "highlight" && !canHighlight ? "full" : regionScope,
            downloadVocals,
          });
        }}
        className="w-full rounded-xl border border-amber-400/35 bg-amber-500/20 py-2 text-xs font-bold text-amber-50 hover:bg-amber-500/30 disabled:opacity-50"
      >
        {busy
          ? "Transforming…"
          : available
            ? "Transform vocals"
            : "Stems not available (Demucs or Mel-Band)"}
      </button>
    </section>
  );
});
