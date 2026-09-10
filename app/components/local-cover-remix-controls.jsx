"use client";

import { memo, useMemo, useState } from "react";
import { useWorkspaceResetEffect } from "../hooks/use-workspace-reset-effect";
import { buildLocalTrackDna, resolveLocalCoverRemixEngine } from "../lib/local-track-dna";
import { hasMeaningfulHighlightRange } from "../lib/audio-highlight-slice";

/**
 * Local cover/remix controls — reverse-engineer the loaded track, generate without Suno.
 */
export const LocalCoverRemixControls = memo(function LocalCoverRemixControls({
  analysis = null,
  busy = false,
  generateAvailable = false,
  acestepAvailable = false,
  vocalTransformAvailable = false,
  onGenerate,
  compact = false,
}) {
  const [mode, setMode] = useState(/** @type {"cover"|"remix"} */ ("cover"));
  const [lyrics, setLyrics] = useState("");
  const [durationSec, setDurationSec] = useState(null);
  const [useHighlight, setUseHighlight] = useState(true);
  const [pitchSemitones, setPitchSemitones] = useState(2);

  useWorkspaceResetEffect(() => {
    setMode("cover");
    setLyrics("");
    setDurationSec(null);
    setUseHighlight(true);
    setPitchSemitones(2);
  });

  const dna = useMemo(() => (analysis ? buildLocalTrackDna(analysis) : null), [analysis]);
  const health = useMemo(
    () => ({
      generate_available: generateAvailable,
      acestep_available: acestepAvailable,
      vocal_transform_available: vocalTransformAvailable,
    }),
    [generateAvailable, acestepAvailable, vocalTransformAvailable],
  );
  const plan = useMemo(() => resolveLocalCoverRemixEngine(mode, health), [mode, health]);
  const canHighlight = analysis && hasMeaningfulHighlightRange(analysis);

  if (!onGenerate || !analysis) return null;

  return (
    <section
      className={`space-y-2 rounded-2xl border border-violet-400/25 bg-violet-500/10 ${
        compact ? "p-2" : "p-3"
      }`}
      data-testid="local-cover-remix-controls"
    >
      <div className="text-[10px] font-bold uppercase tracking-wider text-violet-100/90">
        Local cover / remix
      </div>
      <p className="text-[10px] leading-relaxed text-white/45">
        Reverse-engineer this track (BPM/key/style) and generate a new cover or remix in Studio —
        no Suno. Cover prefers ACE-Step, else MusicGen melody. Remix uses stems + vocal transform.
      </p>

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          disabled={busy}
          onClick={() => setMode("cover")}
          className={`rounded-lg border px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${
            mode === "cover"
              ? "border-violet-300/50 bg-violet-500/30 text-violet-50"
              : "border-white/15 bg-black/20 text-white/55"
          }`}
        >
          Cover
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setMode("remix")}
          className={`rounded-lg border px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${
            mode === "remix"
              ? "border-violet-300/50 bg-violet-500/30 text-violet-50"
              : "border-white/15 bg-black/20 text-white/55"
          }`}
        >
          Remix
        </button>
      </div>

      {dna?.prompt ? (
        <p className="rounded-xl border border-white/10 bg-black/25 px-2 py-1.5 text-[10px] leading-snug text-white/60">
          <span className="font-bold text-white/75">DNA prompt:</span> {dna.prompt}
          {dna.bpm ? ` · ${dna.bpm} BPM` : ""}
          {dna.keyScale ? ` · ${dna.keyScale}` : ""}
        </p>
      ) : null}

      <p className="text-[10px] text-white/50">
        Engine:{" "}
        <span className={plan.engine ? "text-emerald-200/90" : "text-amber-200/90"}>
          {plan.engine || "unavailable"}
        </span>
        {plan.reason ? ` — ${plan.reason}` : ""}
      </p>

      {mode === "cover" && plan.engine === "acestep" ? (
        <label className="block space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/45">
            Lyrics (optional)
          </span>
          <textarea
            value={lyrics}
            onChange={(e) => setLyrics(e.target.value)}
            rows={compact ? 2 : 3}
            disabled={busy}
            placeholder="Optional lyrics for ACE-Step cover"
            className="w-full resize-y rounded-xl border border-white/15 bg-black/30 px-2 py-1.5 text-[11px] text-white/85"
          />
        </label>
      ) : null}

      {mode === "cover" ? (
        <label className="flex items-center gap-2 text-[10px] text-white/60">
          <span className="font-bold uppercase tracking-wider text-white/45">Duration (sec)</span>
          <input
            type="number"
            min={plan.engine === "musicgen-melody" ? 4 : 10}
            max={plan.engine === "musicgen-melody" ? 30 : 600}
            value={durationSec ?? ""}
            placeholder={plan.engine === "musicgen-melody" ? "12" : "60"}
            disabled={busy}
            onChange={(e) => {
              const n = Number(e.target.value);
              setDurationSec(Number.isFinite(n) && n > 0 ? n : null);
            }}
            className="w-20 rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-[11px] text-white/85"
          />
        </label>
      ) : (
        <label className="flex items-center gap-2 text-[10px] text-white/60">
          <span className="font-bold uppercase tracking-wider text-white/45">Pitch (st)</span>
          <input
            type="number"
            min={-12}
            max={12}
            value={pitchSemitones}
            disabled={busy}
            onChange={(e) => setPitchSemitones(Number(e.target.value) || 0)}
            className="w-20 rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-[11px] text-white/85"
          />
        </label>
      )}

      {canHighlight ? (
        <label className="flex items-center gap-2 text-[10px] text-white/60">
          <input
            type="checkbox"
            checked={useHighlight}
            disabled={busy}
            onChange={(e) => setUseHighlight(e.target.checked)}
          />
          Use highlight region
          {mode === "cover" ? " as melody reference" : " for transform"}
        </label>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="local-cover-remix-generate"
          disabled={busy || !plan.engine}
          onClick={() =>
            void onGenerate({
              mode,
              lyrics,
              durationSec,
              useHighlightMelody: useHighlight,
              remixPitchSemitones: pitchSemitones,
              attach: true,
              download: false,
            })
          }
          className="rounded-xl border border-violet-300/40 bg-violet-500/25 px-3 py-2 text-[11px] font-bold text-violet-50 hover:bg-violet-500/35 disabled:opacity-50"
        >
          {busy ? "Working…" : mode === "remix" ? "Generate remix" : "Generate cover"}
        </button>
        <button
          type="button"
          disabled={busy || !plan.engine}
          onClick={() =>
            void onGenerate({
              mode,
              lyrics,
              durationSec,
              useHighlightMelody: useHighlight,
              remixPitchSemitones: pitchSemitones,
              attach: true,
              download: true,
            })
          }
          className="rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-[11px] font-bold text-white/70 hover:bg-white/10 disabled:opacity-50"
        >
          Generate + download
        </button>
      </div>
    </section>
  );
});
