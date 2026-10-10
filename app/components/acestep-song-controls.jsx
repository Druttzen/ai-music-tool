"use client";

import { memo, useEffect, useState } from "react";
import { useWorkspaceResetEffect } from "../hooks/use-workspace-reset-effect";
import { ensureAceStepApi, fetchAceStepPresets } from "../lib/sidecar-bridge";

const ACE_ENV_SNIPPET = `AIMC_ACESTEP_API_URL=http://127.0.0.1:8001
# AIMC_ACESTEP_API_KEY=
# AIMC_ACESTEP_MODEL=acestep-v15-turbo`;

const ACE_DOCS_URL =
  "https://github.com/Druttzen/ai-music-tool/blob/master/docs/acestep.md";

/**
 * ACE-Step full-song controls (requires AIMC_ACESTEP_API_URL).
 * @param {{ defaultPrompt?: string, defaultLyrics?: string, defaultBpm?: number|null, defaultKey?: string, busy?: boolean, canCancel?: boolean, cancelRequested?: boolean, onCancel?: () => void, available?: boolean, installHint?: string, onGenerate?: (prompt: string, options?: object) => void, compact?: boolean }} props
 */
export const AceStepSongControls = memo(function AceStepSongControls({
  defaultPrompt = "",
  defaultLyrics = "",
  defaultBpm = null,
  defaultKey = "",
  lastTake,
  busy = false,
  canCancel = false,
  cancelRequested = false,
  onCancel,
  available = false,
  installHint = "Start ACE-Step (`uv run acestep-api`) and set AIMC_ACESTEP_API_URL — see docs/acestep.md",
  onGenerate,
  compact = false,
}) {
  const [promptOverride, setPromptOverride] = useState(lastTake?.prompt ?? null);
  const [lyricsOverride, setLyricsOverride] = useState(lastTake?.lyrics ?? null);
  const [durationSec, setDurationSec] = useState(lastTake?.durationSec ?? 60);
  const [useDna, setUseDna] = useState(lastTake ? (lastTake.useDna ?? !!(lastTake.bpm || lastTake.keyScale)) : true);
  const dnaBpm = lastTake?.bpm ?? defaultBpm;
  const dnaKey = lastTake?.keyScale || defaultKey;
  const [thinking, setThinking] = useState(lastTake?.thinking ?? true);
  const [quality, setQuality] = useState(lastTake?.model === "acestep-v15-sft" ? "sft" : lastTake?.model === "acestep-v15-base" ? "quality" : "turbo");
  const [qualityAvailable, setQualityAvailable] = useState(false);
  const [sftAvailable, setSftAvailable] = useState(false);
  const [guidanceScale, setGuidanceScale] = useState(lastTake?.guidanceScale ?? 7);
  const [qualityNote, setQualityNote] = useState("");
  const [seed, setSeed] = useState(lastTake?.seed == null ? "" : String(lastTake.seed));
  const [copyStatus, setCopyStatus] = useState("");
  const [startingApi, setStartingApi] = useState(false);
  const [startupMessage, setStartupMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!available) {
      setQualityAvailable(false);
      setSftAvailable(false);
      setQualityNote("");
      return () => {
        cancelled = true;
      };
    }
    setQualityAvailable(false);
    setQualityNote("Checking installed ACE-Step presets…");
    void fetchAceStepPresets().then((catalog) => {
      if (cancelled) return;
      const canUseQuality = !!catalog?.quality_available;
      setQualityAvailable(canUseQuality);
      setSftAvailable(!!catalog?.sft_available);
      setQualityNote(
        canUseQuality
          ? ""
          : "Additional checkpoints must be installed before selecting them.",
      );
    });
    return () => {
      cancelled = true;
    };
  }, [available]);

  useWorkspaceResetEffect(() => {
    setPromptOverride(null);
    setLyricsOverride(null);
    setDurationSec(60);
    setUseDna(true);
    setThinking(true);
    setQuality("turbo");
    setSeed("");
    setGuidanceScale(7);
    setCopyStatus("");
  });

  const prompt = promptOverride ?? defaultPrompt ?? "";
  const lyrics = lyricsOverride ?? defaultLyrics ?? "";
  const selectedCheckpointAvailable = quality === "turbo" || (quality === "sft" ? sftAvailable : qualityAvailable);

  if (!onGenerate) return null;

  const copyEnv = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(ACE_ENV_SNIPPET);
        setCopyStatus("Env snippet copied");
      } else {
        setCopyStatus("Clipboard blocked");
      }
    } catch {
      setCopyStatus("Copy failed");
    }
  };

  const startApi = async () => {
    if (startingApi) return;
    setStartingApi(true);
    setStartupMessage("Starting local ACE-Step…");
    try {
      const result = await ensureAceStepApi();
      if (!result.ok) throw new Error("ACE-Step did not become ready");
      setStartupMessage("ACE-Step started — checking readiness…");
      window.dispatchEvent(new Event("aimc-sidecar-refresh"));
    } catch (error) {
      setStartupMessage(error instanceof Error ? error.message : "Could not start ACE-Step");
    } finally {
      setStartingApi(false);
    }
  };

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
        Local songs with vocals or instrumental arrangements. SFT offers more detail and prompt control;
        it is slower and is not always cleaner than Turbo. No Suno quality equivalence has been established.
        Sidecar marks ACE ready only when the API is{" "}
        <span className="font-semibold text-white/70">reachable</span> at{" "}
        <code className="text-white/60">AIMC_ACESTEP_API_URL</code>.
      </p>
      {!available ? (
        <div className="space-y-2 rounded-xl border border-amber-400/25 bg-amber-500/10 px-2 py-2 text-[10px] text-amber-100/90">
          <p className="font-semibold text-amber-50">Not ready — start ACE-Step</p>
          <button type="button" onClick={() => void startApi()} disabled={startingApi}
            className="rounded-lg bg-emerald-300 px-3 py-2 font-bold text-black disabled:opacity-50">
            {startingApi ? "Starting ACE-Step…" : "Start local ACE-Step"}
          </button>
          {startupMessage && <p role="status">{startupMessage}</p>}
          <ol className="list-decimal space-y-1 pl-4 text-amber-100/80">
            <li>
              In the ACE-Step repo: <code className="text-white/70">uv run acestep-api</code> (default{" "}
              <code className="text-white/70">http://127.0.0.1:8001</code>)
            </li>
            <li>
              Put the env snippet in <code className="text-white/70">ai-sidecar/.env.vocal</code> (or
              process env)
            </li>
            <li>
              Restart the music sidecar (<code className="text-white/70">npm run sidecar</code>)
            </li>
          </ol>
          <p className="text-amber-100/70">{installHint}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                void copyEnv();
              }}
              className="rounded-lg border border-amber-400/35 bg-amber-500/20 px-2 py-1 text-[10px] font-bold text-amber-50 hover:bg-amber-500/30"
            >
              Copy env snippet
            </button>
            <a
              href={ACE_DOCS_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-[10px] font-semibold text-white/70 hover:text-white"
            >
              Open docs/acestep.md
            </a>
          </div>
          {copyStatus ? <p className="text-white/45">{copyStatus}</p> : null}
        </div>
      ) : null}
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
      <label className="flex items-center gap-2 text-[10px] text-white/55">
        <input type="checkbox" checked={useDna} disabled={busy} onChange={(e) => setUseDna(e.target.checked)} />
        Use track DNA
        {dnaBpm || dnaKey ? ` (${[dnaBpm ? `${dnaBpm} BPM` : "", dnaKey].filter(Boolean).join(" · ")})` : ""}
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-[10px] text-white/50">
          Quality
          <select aria-label="Quality" value={quality} disabled={busy} onChange={(e) => setQuality(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/15 bg-black/35 p-1.5 text-xs text-white">
            <option value="turbo">Turbo (faster)</option>
            <option value="sft" disabled={!sftAvailable}>{sftAvailable ? "Detail (SFT · 50 steps)" : "Detail (SFT checkpoint not installed)"}</option>
            <option value="quality" disabled={!qualityAvailable}>
              {qualityAvailable ? "Base (50 steps · editing / training)" : "Base (checkpoint not installed)"}
            </option>
          </select>
          {qualityNote ? <span className="mt-1 block text-[10px] text-amber-100/80">{qualityNote}</span> : null}
        </label>
        <label className="block text-[10px] text-white/50">
          Seed
          <input type="number" min="0" value={seed} disabled={busy} placeholder="Random"
            onChange={(e) => setSeed(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/15 bg-black/35 p-1.5 text-xs text-white" />
        </label>
      </div>
      {quality !== "turbo" ? <label className="block text-[10px] text-white/50">Prompt guidance
        <input type="number" min="0" max="20" step="0.5" value={guidanceScale} disabled={busy} onChange={e => setGuidanceScale(Number(e.target.value))}
          className="ml-2 rounded border border-white/20 bg-black/50 p-1 text-white" />
      </label> : null}
      <label className="flex items-center gap-2 text-[10px] text-white/55">
        <input type="checkbox" checked={thinking} disabled={busy}
          onChange={(e) => setThinking(e.target.checked)} />
        LM thinking
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
          disabled={busy || !available || !selectedCheckpointAvailable}
          onClick={(e) => {
            e.preventDefault();
            onGenerate(prompt, {
              lyrics,
              durationSec,
              attach: true,
              useDna,
              bpm: useDna ? dnaBpm : null,
              keyScale: useDna ? dnaKey : "",
              thinking,
              inferenceSteps: quality === "turbo" ? 8 : 50,
              guidanceScale: quality === "turbo" ? undefined : guidanceScale,
              seed: seed.trim() ? Number(seed) : null,
              model: quality === "sft" ? "acestep-v15-sft" : quality === "quality" ? "acestep-v15-base" : "acestep-v15-turbo",
            });
          }}
          className="min-w-[140px] flex-1 rounded-xl border border-emerald-400/35 bg-emerald-500/20 py-2 text-xs font-bold text-emerald-50 hover:bg-emerald-500/30 disabled:opacity-50"
        >
          {busy ? "Generating…" : !available ? "ACE-Step API unreachable" : selectedCheckpointAvailable ? "Generate full song" : "Selected checkpoint unavailable"}
        </button>
        <button
          type="button"
          disabled={busy || !available || !selectedCheckpointAvailable}
          onClick={(e) => {
            e.preventDefault();
            onGenerate(prompt, {
              lyrics,
              durationSec,
              attach: false,
              download: true,
              useDna,
              bpm: useDna ? dnaBpm : null,
              keyScale: useDna ? dnaKey : "",
              thinking,
              inferenceSteps: quality === "turbo" ? 8 : 50,
              guidanceScale: quality === "turbo" ? undefined : guidanceScale,
              seed: seed.trim() ? Number(seed) : null,
              model: quality === "sft" ? "acestep-v15-sft" : quality === "quality" ? "acestep-v15-base" : "acestep-v15-turbo",
            });
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
