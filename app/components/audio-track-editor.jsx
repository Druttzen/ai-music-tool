"use client";

import { useCallback, useEffect, useRef, useState, memo } from "react";
import { SUPPORTED_AUDIO_ACCEPT, SUPPORTED_AUDIO_LABEL } from "../lib/analyzer-file-types";
import { formatTime } from "../lib/audio-analyzer";
import { getAudioAnalyzerDisclaimer } from "../lib/analyzer-disclaimer";
import { isLikelyInstrumentalTrack } from "../lib/instrumental-lyrics-from-track";
import { STUDIO_EXPORT_PRESETS } from "../lib/audio-enhancer";
import {
  formatLufs,
  formatTruePeak,
  STREAMING_TARGET_LUFS,
} from "../lib/lufs-meter";
import { clamp } from "../lib/music-helpers";
import { AudioHighlightWaveform } from "./audio-highlight-waveform";
import { AudioWaveformProPrototype } from "./audio-waveform-pro-prototype";

const ENABLE_WAVESURFER_PROTOTYPE = process.env.NEXT_PUBLIC_WAVESURFER_PROTOTYPE === "1";

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
 * @param {{ analysis: object, audioUrl?: string|null, loudness?: { integratedLUFS: number, truePeakDbTP: number }|null, loudnessBusy?: boolean, onChange: (patch: object) => void, onApply: () => void, onClear?: () => void, onAttachAudio?: (file: File) => void, onAddLyricsForTrack?: () => void, onAnalyzeVocalCharacter?: () => void, onExportEnhanced?: (presetId: string, opts?: { format?: string, scope?: string }) => void, onSeparateStems?: () => void, onDownloadStem?: (stem: object) => void, stemSeparationBusy?: boolean, stemSeparationStems?: object[], exportBusy?: boolean, exportProgress?: { phase: string, pct: number }|null }} props
 */
export const AudioTrackEditor = memo(function AudioTrackEditor({
  analysis,
  audioUrl,
  loudness = null,
  loudnessBusy = false,
  onChange,
  onApply,
  onClear,
  onAttachAudio,
  onAddLyricsForTrack,
  onAnalyzeVocalCharacter,
  onExportEnhanced,
  onSeparateStems,
  onDownloadStem,
  stemSeparationBusy = false,
  stemSeparationStems = [],
  exportBusy = false,
  exportProgress = null,
}) {
  const audioRef = useRef(null);
  const [playhead, setPlayhead] = useState(null);
  const [exportFormat, setExportFormat] = useState("wav");
  const [highlightPreset, setHighlightPreset] = useState("streaming");
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
    if (!Number.isNaN(n)) {
      const bpm = clamp(Math.round(n), 60, 200);
      onChange({ bpm, estimatedBpm: `${bpm} BPM` });
    }
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

      <p className="rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-[10px] leading-relaxed text-amber-100/90">
        {getAudioAnalyzerDisclaimer(analysis)}
      </p>

      <section className="rounded-2xl border border-amber-400/20 bg-black/30 p-3 space-y-2">
        <div className="text-[10px] font-bold uppercase tracking-wider text-amber-200/90">Highlight</div>
        <p className="text-xs text-white/75">{analysis.highlightLabel}</p>
        <AudioHighlightWaveform
          analysis={analysis}
          audioUrl={audioUrl}
          playhead={playhead}
          onSeek={audioUrl ? seekAudio : undefined}
          onHighlightChange={(range) => onChange(range)}
        />
      </section>

      {ENABLE_WAVESURFER_PROTOTYPE ? (
        <AudioWaveformProPrototype
          audioUrl={audioUrl}
          analysis={analysis}
          onHighlightChange={(range) => onChange(range)}
        />
      ) : null}

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

      {onAddLyricsForTrack && isLikelyInstrumentalTrack(analysis) ? (
        <section className="rounded-2xl border border-fuchsia-400/25 bg-fuchsia-500/10 p-3 space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-fuchsia-200/90">
            Add lyrics to this instrumental
          </div>
          <p className="text-[10px] leading-relaxed text-white/55">
            Builds a timed [Verse]/[Chorus] scaffold locked to this track&apos;s BPM, duration, and
            highlight — switches vocal mode from Instrumental and fills the Suno Lyrics field.
          </p>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onAddLyricsForTrack();
            }}
            className="w-full rounded-2xl border border-fuchsia-400/40 bg-fuchsia-500/25 py-2 text-xs font-bold text-fuchsia-50 hover:bg-fuchsia-500/35"
          >
            Add lyrics timed to this track →
          </button>
        </section>
      ) : null}

      {onAnalyzeVocalCharacter ? (
        <section className="rounded-2xl border border-cyan-400/25 bg-cyan-500/10 p-3 space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-200/90">
            Vocal character (Voice Character Studio)
          </div>
          <p className="text-[10px] leading-relaxed text-white/55">
            Send this track to Voice Character Studio for trait-based Suno voice DNA. Acapella or
            isolated lead works best; full mixes may yield weak pitch signal.
          </p>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onAnalyzeVocalCharacter();
            }}
            className="w-full rounded-2xl border border-cyan-400/40 bg-cyan-500/25 py-2 text-xs font-bold text-cyan-50 hover:bg-cyan-500/35"
          >
            Analyze vocal character →
          </button>
        </section>
      ) : null}

      {onExportEnhanced ? (
        <section className="rounded-2xl border border-violet-400/25 bg-violet-500/10 p-3 space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-violet-200/90">
            Studio export
          </div>
          <div className="rounded-xl border border-violet-400/20 bg-black/25 px-3 py-2 font-mono text-[11px] text-violet-100/90">
            {loudnessBusy ? (
              <span className="text-white/45">Measuring LUFS…</span>
            ) : loudness ? (
              <span>
                Source: {formatLufs(loudness.integratedLUFS)} · {formatTruePeak(loudness.truePeakDbTP)} · BS.1770-4
                / EBU R128
              </span>
            ) : (
              <span className="text-white/40">
                Attach audio to measure gated integrated LUFS (EBU R128)
              </span>
            )}
          </div>
          <p className="text-[10px] leading-relaxed text-white/45">
            Mastering runs in a background worker with progress. Streaming normalizes to{" "}
            {STREAMING_TARGET_LUFS} LUFS (gated integrated) with −1 dBTP limit.
          </p>
          <div className="flex flex-wrap items-center gap-2 text-[10px] text-white/50">
            <span>Format</span>
            {[
              ["wav", "WAV 16-bit"],
              ["wav24", "WAV 24-bit"],
              ["mp3", "MP3"],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                disabled={exportBusy}
                onClick={() => setExportFormat(id)}
                className={
                  "rounded-lg px-2 py-0.5 font-bold " +
                  (exportFormat === id
                    ? "bg-violet-400 text-black"
                    : "border border-white/15 text-white/60")
                }
              >
                {label}
              </button>
            ))}
          </div>
          {exportBusy && exportProgress ? (
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-white/45">
                <span className="capitalize">{exportProgress.phase}</span>
                <span>{Math.round(exportProgress.pct)}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-black/40">
                <div
                  className="h-full bg-violet-400 transition-all duration-300"
                  style={{ width: `${Math.min(100, exportProgress.pct)}%` }}
                />
              </div>
            </div>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-3">
            {STUDIO_EXPORT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                disabled={exportBusy}
                onClick={(e) => {
                  e.preventDefault();
                  onExportEnhanced(preset.id, { format: exportFormat, scope: "full" });
                }}
                className="rounded-2xl border border-violet-400/35 bg-violet-500/20 px-2 py-2 text-left transition hover:bg-violet-500/30 disabled:cursor-wait disabled:opacity-50"
              >
                <div className="text-xs font-bold text-violet-50">{preset.label}</div>
                <div className="mt-0.5 text-[10px] text-white/40">{preset.hint}</div>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex flex-1 min-w-[140px] flex-col text-[10px] text-white/50">
              Highlight preset
              <select
                value={highlightPreset}
                disabled={exportBusy}
                onChange={(e) => setHighlightPreset(e.target.value)}
                className="mt-1 rounded-lg border border-white/15 bg-black/35 p-1.5 text-xs text-white"
              >
                {STUDIO_EXPORT_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={exportBusy}
              onClick={(e) => {
                e.preventDefault();
                onExportEnhanced(highlightPreset, { format: exportFormat, scope: "highlight" });
              }}
              className="flex-1 min-w-[160px] rounded-xl border border-amber-400/30 bg-amber-500/15 py-2 text-[10px] font-bold text-amber-100 hover:bg-amber-500/25 disabled:opacity-50"
            >
              Export highlight loop (amber range)
            </button>
          </div>
        </section>
      ) : null}

      {onSeparateStems ? (
        <section className="rounded-2xl border border-fuchsia-400/25 bg-fuchsia-500/10 p-3 space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-fuchsia-100/90">
            Demucs stem separation
          </div>
          <p className="text-[10px] leading-relaxed text-white/45">
            Requires the Python sidecar with the <code className="text-white/60">stems</code> extra installed
            (torch + demucs). Returns vocals, drums, bass, and other stems as WAV downloads.
          </p>
          <button
            type="button"
            disabled={stemSeparationBusy || exportBusy}
            onClick={(e) => {
              e.preventDefault();
              onSeparateStems();
            }}
            className="w-full rounded-xl border border-fuchsia-400/35 bg-fuchsia-500/20 py-2 text-xs font-bold text-fuchsia-50 hover:bg-fuchsia-500/30 disabled:opacity-50"
          >
            {stemSeparationBusy ? "Separating stems…" : "Separate stems (Demucs)"}
          </button>
          {stemSeparationStems?.length ? (
            <div className="flex flex-wrap gap-2">
              {stemSeparationStems.map((stem) => (
                <button
                  key={stem.name}
                  type="button"
                  disabled={stemSeparationBusy}
                  onClick={(e) => {
                    e.preventDefault();
                    onDownloadStem?.(stem);
                  }}
                  className="rounded-lg border border-white/15 bg-black/30 px-2.5 py-1 text-[10px] font-semibold text-white/75 hover:text-white"
                >
                  ↓ {stem.name}
                </button>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

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
});
