"use client";

import { memo, useState } from "react";
import { useWorkspaceResetEffect } from "../hooks/use-workspace-reset-effect";

const ACE_ENV_SNIPPET = `AIMC_ACESTEP_API_URL=http://127.0.0.1:8001
# AIMC_ACESTEP_API_KEY=
# AIMC_ACESTEP_MODEL=acestep-v15-turbo`;

const ACE_DOCS_URL =
  "https://github.com/Druttzen/ai-music-tool/blob/master/docs/acestep.md";

/**
 * ACE-Step full-song controls (requires AIMC_ACESTEP_API_URL).
 * @param {{ defaultPrompt?: string, defaultLyrics?: string, defaultBpm?: number|null, defaultKey?: string, busy?: boolean, available?: boolean, installHint?: string, onGenerate?: (prompt: string, options?: object) => void, compact?: boolean }} props
 */
export const AceStepSongControls = memo(function AceStepSongControls({
  defaultPrompt = "",
  defaultLyrics = "",
  defaultBpm = null,
  defaultKey = "",
  busy = false,
  available = false,
  installHint = "Start ACE-Step (`uv run acestep-api`) and set AIMC_ACESTEP_API_URL — see docs/acestep.md",
  onGenerate,
  compact = false,
}) {
  const [promptOverride, setPromptOverride] = useState(null);
  const [lyricsOverride, setLyricsOverride] = useState(null);
  const [durationSec, setDurationSec] = useState(60);
  const [useDna, setUseDna] = useState(true);
  const [thinking, setThinking] = useState(true);
  const [quality, setQuality] = useState("turbo");
  const [seed, setSeed] = useState("");
  const [copyStatus, setCopyStatus] = useState("");

  useWorkspaceResetEffect(() => {
    setPromptOverride(null);
    setLyricsOverride(null);
    setDurationSec(60);
    setUseDna(true);
    setThinking(true);
    setQuality("turbo");
    setSeed("");
    setCopyStatus("");
  });

  const prompt = promptOverride ?? defaultPrompt ?? "";
  const lyrics = lyricsOverride ?? defaultLyrics ?? "";

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
        Local full-song generation via an external ACE-Step API (MIT weights — longer than MusicGen).
        Sidecar marks ACE ready only when the API is{" "}
        <span className="font-semibold text-white/70">reachable</span> at{" "}
        <code className="text-white/60">AIMC_ACESTEP_API_URL</code>.
      </p>
      {!available ? (
        <div className="space-y-2 rounded-xl border border-amber-400/25 bg-amber-500/10 px-2 py-2 text-[10px] text-amber-100/90">
          <p className="font-semibold text-amber-50">Not ready — start ACE-Step</p>
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
        {defaultBpm || defaultKey ? ` (${[defaultBpm ? `${defaultBpm} BPM` : "", defaultKey].filter(Boolean).join(" · ")})` : ""}
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-[10px] text-white/50">
          Quality
          <select value={quality} disabled={busy} onChange={(e) => setQuality(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/15 bg-black/35 p-1.5 text-xs text-white">
            <option value="turbo">Turbo (faster)</option>
            <option value="quality">Quality (thinking + 32 steps)</option>
          </select>
        </label>
        <label className="block text-[10px] text-white/50">
          Seed
          <input type="number" min="0" value={seed} disabled={busy} placeholder="Random"
            onChange={(e) => setSeed(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/15 bg-black/35 p-1.5 text-xs text-white" />
        </label>
      </div>
      <label className="flex items-center gap-2 text-[10px] text-white/55">
        <input type="checkbox" checked={thinking || quality === "quality"} disabled={busy || quality === "quality"}
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
          disabled={busy || !available}
          onClick={(e) => {
            e.preventDefault();
            onGenerate(prompt, {
              lyrics,
              durationSec,
              attach: true,
              bpm: useDna ? defaultBpm : null,
              keyScale: useDna ? defaultKey : "",
              thinking: quality === "quality" ? true : thinking,
              inferenceSteps: quality === "quality" ? 32 : 8,
              seed: seed.trim() ? Number(seed) : null,
              model: quality === "quality" ? "acestep-v15-base" : "acestep-v15-turbo",
            });
          }}
          className="min-w-[140px] flex-1 rounded-xl border border-emerald-400/35 bg-emerald-500/20 py-2 text-xs font-bold text-emerald-50 hover:bg-emerald-500/30 disabled:opacity-50"
        >
          {busy ? "Generating…" : available ? "Generate full song" : "ACE-Step API unreachable"}
        </button>
        <button
          type="button"
          disabled={busy || !available}
          onClick={(e) => {
            e.preventDefault();
            onGenerate(prompt, {
              lyrics,
              durationSec,
              attach: false,
              download: true,
              bpm: useDna ? defaultBpm : null,
              keyScale: useDna ? defaultKey : "",
              thinking: quality === "quality" ? true : thinking,
              inferenceSteps: quality === "quality" ? 32 : 8,
              seed: seed.trim() ? Number(seed) : null,
              model: quality === "quality" ? "acestep-v15-base" : "acestep-v15-turbo",
            });
          }}
          className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-[10px] font-semibold text-white/70 hover:text-white disabled:opacity-50"
        >
          Download only
        </button>
      </div>
    </section>
  );
});
