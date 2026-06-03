"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SUPPORTED_AUDIO_ACCEPT, SUPPORTED_AUDIO_LABEL } from "../lib/analyzer-file-types";
import { formatTime } from "../lib/audio-analyzer";
import { AudioHighlightWaveform } from "./audio-highlight-waveform";

function TagField({ label, hint, value, onChange, placeholder }) {
  return (
    <label className="block">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">{label}</span>
        {hint ? <span className="text-[10px] text-white/30">{hint}</span> : null}
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-xs text-white outline-none focus:border-cyan-400/50"
      />
    </label>
  );
}

function splitTags(s) {
  return String(s || "")
    .split(/[,;|]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function joinTags(arr) {
  return (arr || []).join(", ");
}

/**
 * Sonoteller-style editable local analysis report.
 * @param {{ analysis: object, audioUrl?: string|null, onChange: (patch: object) => void, onApply: () => void, onClear?: () => void, onAttachAudio?: (file: File) => void }} props
 */
export function AudioTrackEditor({ analysis, audioUrl, onChange, onApply, onClear, onAttachAudio }) {
  const audioRef = useRef(null);
  const [playhead, setPlayhead] = useState(null);
  const rafRef = useRef(null);

  const seekAudio = useCallback(
    (time) => {
      const player = audioRef.current;
      if (!player) return;
      const max = player.duration || analysis?.duration || 0;
      player.currentTime = Math.min(max, Math.max(0, time));
      if (player.paused) player.play().catch(() => {});
    },
    [analysis?.duration],
  );

  useEffect(() => {
    const player = audioRef.current;
    if (!player || !audioUrl) {
      setPlayhead(null);
      return undefined;
    }

    const sync = () => setPlayhead(player.currentTime);

    const onPlay = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const tick = () => {
        sync();
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    };

    const onStop = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      sync();
    };

    player.addEventListener("play", onPlay);
    player.addEventListener("pause", onStop);
    player.addEventListener("seeked", onStop);
    player.addEventListener("ended", onStop);
    player.addEventListener("timeupdate", sync);

    if (!player.paused) onPlay();
    else sync();

    return () => {
      player.removeEventListener("play", onPlay);
      player.removeEventListener("pause", onStop);
      player.removeEventListener("seeked", onStop);
      player.removeEventListener("ended", onStop);
      player.removeEventListener("timeupdate", sync);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [audioUrl]);

  if (!analysis) return null;

  const setTags = (key, text) => onChange({ [key]: splitTags(text) });
  const setBpmFromText = (text) => {
    const n = parseInt(String(text).replace(/\D/g, ""), 10);
    if (!Number.isNaN(n)) onChange({ bpm: clampBpm(n), estimatedBpm: `${clampBpm(n)} BPM` });
  };

  return (
    <div
      className="mt-3 space-y-3 text-left"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {audioUrl ? (
        <audio ref={audioRef} controls src={audioUrl} className="w-full rounded-xl" preload="metadata" />
      ) : onAttachAudio ? (
        <label className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border border-dashed border-white/20 bg-black/30 px-3 py-4 text-center hover:border-cyan-400/40">
          <span className="text-xs font-bold text-cyan-100">Attach audio file</span>
          <span className="text-[10px] text-white/45">
            Same track ({analysis.fileName}, ~{formatTime(analysis.duration)}) — restores player & accurate waveform
          </span>
          <input
            type="file"
            accept={SUPPORTED_AUDIO_ACCEPT}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onAttachAudio(file);
              e.target.value = "";
            }}
          />
        </label>
      ) : null}
      {!audioUrl && onAttachAudio ? (
        <p className="text-[10px] text-white/35">{SUPPORTED_AUDIO_LABEL}</p>
      ) : null}

      <div className="rounded-2xl border border-orange-400/25 bg-orange-500/10 px-3 py-2">
        <div className="text-[10px] font-bold uppercase tracking-wider text-orange-200/90">Track</div>
        <div className="mt-1 truncate text-sm font-semibold text-white">{analysis.fileName}</div>
        <div className="mt-0.5 text-[11px] text-white/50">
          {formatTime(0)} – {formatTime(analysis.duration)} · Local scan (edit before merge)
        </div>
      </div>

      <section className="rounded-2xl border border-amber-400/20 bg-black/30 p-3 space-y-2">
        <div className="text-[10px] font-bold uppercase tracking-wider text-amber-200/90">Highlight</div>
        <p className="text-xs text-white/75">{analysis.highlightLabel}</p>
        <AudioHighlightWaveform
          analysis={analysis}
          audioUrl={audioUrl}
          playhead={playhead}
          onSeek={audioUrl ? seekAudio : undefined}
        />
      </section>

      <section className="rounded-2xl border border-cyan-400/20 bg-black/30 p-3 space-y-2">
        <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-200/90">Music analysis</div>
        <label className="block">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-white/50">Summary</div>
          <textarea
            value={analysis.trackSummary || ""}
            onChange={(e) => onChange({ trackSummary: e.target.value })}
            rows={3}
            className="w-full resize-y rounded-xl border border-white/10 bg-black/35 p-2 text-xs text-white outline-none focus:border-cyan-400/50"
          />
        </label>
        <TagField
          label="Genres"
          value={joinTags(analysis.suggestedGenres)}
          onChange={(v) => setTags("suggestedGenres", v)}
          placeholder="Techno, Electronic"
        />
        <TagField
          label="Subgenres"
          value={joinTags(analysis.suggestedSubgenres)}
          onChange={(v) => setTags("suggestedSubgenres", v)}
        />
        <TagField
          label="Moods"
          value={joinTags(analysis.suggestedMoods)}
          onChange={(v) => setTags("suggestedMoods", v)}
        />
        <TagField
          label="Instruments"
          value={joinTags(analysis.suggestedInstruments)}
          onChange={(v) => setTags("suggestedInstruments", v)}
        />
        <TagField
          label="Sounds (Suno merge)"
          hint="merged into sound list"
          value={joinTags(analysis.suggestedSounds)}
          onChange={(v) => setTags("suggestedSounds", v)}
        />
        <TagField
          label="Rhythm (Suno merge)"
          value={joinTags(analysis.suggestedRhythms)}
          onChange={(v) => setTags("suggestedRhythms", v)}
        />
      </section>

      <section className="rounded-2xl border border-emerald-400/20 bg-black/30 p-3 space-y-2">
        <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-200/90">Technical</div>
        <div className="grid grid-cols-2 gap-2">
          <TagField
            label="BPM"
            value={String(analysis.bpm ?? "").replace(/\D/g, "") || analysis.estimatedBpm?.replace(/\D/g, "")}
            onChange={setBpmFromText}
            placeholder="128"
          />
          <TagField
            label="Key (estimate)"
            value={analysis.estimatedKey || ""}
            onChange={(v) => onChange({ estimatedKey: v })}
          />
        </div>
        <TagField
          label="Vocals"
          value={analysis.vocals || ""}
          onChange={(v) => onChange({ vocals: v })}
        />
        <div className="grid grid-cols-3 gap-1 font-mono text-[10px] text-white/45">
          <span>E {analysis.energy}</span>
          <span>A {analysis.aggression}</span>
          <span>B {analysis.brightness}</span>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            onApply();
          }}
          className="flex-1 min-w-[140px] rounded-2xl border border-cyan-400/40 bg-cyan-500/20 py-2 text-xs font-bold text-cyan-50 hover:bg-cyan-500/30"
        >
          Merge into Suno fields →
        </button>
        {onClear ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onClear();
            }}
            className="rounded-2xl border border-white/15 bg-black/30 px-3 py-2 text-xs font-semibold text-white/55 hover:text-white"
          >
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}

function clampBpm(n) {
  return Math.min(200, Math.max(60, Math.round(n)));
}
