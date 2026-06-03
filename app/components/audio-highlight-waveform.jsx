"use client";

import { formatTime, sliceWaveformPeaksForRange } from "../lib/audio-analyzer";

/**
 * @param {object} props
 * @param {number[]} props.peaks — 0–1 per bar
 * @param {number} props.duration
 * @param {number} props.highlightStart
 * @param {number} props.highlightEnd
 * @param {number|null} props.playhead — current time in seconds
 * @param {"full"|"highlight"} props.mode
 * @param {(time: number) => void} [props.onSeek]
 */
function WaveformStrip({ peaks, duration, highlightStart, highlightEnd, playhead, mode, onSeek }) {
  if (!peaks?.length) {
    return (
      <div className="flex h-16 items-center justify-center rounded-xl border border-white/10 bg-black/40 px-2 text-center text-[10px] text-white/35">
        Building waveform…
      </div>
    );
  }

  const dur = Math.max(0.001, duration || 0);
  const hStart = Math.max(0, Math.min(dur, highlightStart ?? 0));
  const hEnd = Math.max(hStart, Math.min(dur, highlightEnd ?? dur));
  const isHighlightView = mode === "highlight";

  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!onSeek) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    if (isHighlightView) {
      const span = hEnd - hStart;
      onSeek(hStart + ratio * span);
    } else {
      onSeek(ratio * dur);
    }
  };

  const playheadRatio = (() => {
    if (playhead == null || Number.isNaN(playhead)) return null;
    if (isHighlightView) {
      const span = hEnd - hStart;
      if (span < 0.01) return null;
      if (playhead < hStart || playhead > hEnd) return null;
      return (playhead - hStart) / span;
    }
    return clamp(playhead / dur, 0, 1);
  })();

  const highlightLeft = (hStart / dur) * 100;
  const highlightWidth = ((hEnd - hStart) / dur) * 100;

  return (
    <button
      type="button"
      onClick={handleClick}
      className="relative block w-full cursor-pointer rounded-xl border border-white/10 bg-black/50 p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
      aria-label={isHighlightView ? "Highlight section waveform — click to seek" : "Full track waveform — click to seek"}
    >
      <div className="relative flex h-16 items-end gap-px overflow-hidden rounded-lg px-0.5">
        {!isHighlightView ? (
          <div
            className="pointer-events-none absolute inset-y-1 z-0 rounded-md border border-amber-400/35 bg-amber-400/15"
            style={{ left: `${highlightLeft}%`, width: `${highlightWidth}%` }}
            title={`Highlight ${formatTime(hStart)} – ${formatTime(hEnd)}`}
          />
        ) : null}
        {peaks.map((peak, i) => {
          const barTime = isHighlightView
            ? hStart + ((i + 0.5) / peaks.length) * (hEnd - hStart)
            : ((i + 0.5) / peaks.length) * dur;
          const inHighlight = barTime >= hStart && barTime <= hEnd;
          const h = Math.max(8, Math.round(peak * 100));
          return (
            <div
              key={i}
              className={`relative z-[1] min-w-0 flex-1 rounded-sm ${
                isHighlightView || inHighlight ? "bg-amber-400/85" : "bg-cyan-500/35"
              }`}
              style={{ height: `${h}%` }}
            />
          );
        })}
        {playheadRatio != null ? (
          <div
            className="pointer-events-none absolute inset-y-0 z-[2] w-0.5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)]"
            style={{ left: `${playheadRatio * 100}%` }}
          />
        ) : null}
      </div>
    </button>
  );
}

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Full-track + highlight-zoom waveforms synced to the preview player.
 */
export function AudioHighlightWaveform({ analysis, audioUrl, onSeek, playhead }) {
  const duration = analysis?.duration || 0;
  const peaks = analysis?.waveformPeaks || [];
  const highlightStart = analysis?.highlightStart ?? 0;
  const highlightEnd = analysis?.highlightEnd ?? duration;
  const highlightPeaks = sliceWaveformPeaksForRange(peaks, duration, highlightStart, highlightEnd);

  if (!peaks.length) return null;

  const sourceNote =
    analysis?.waveformSource === "estimated"
      ? "Estimated shape — use Attach audio below for sample-accurate peaks and playback."
      : analysis?.waveformSource === "cached"
        ? "Waveform and player restored from cached audio."
        : analysis?.waveformSource === "saved"
          ? "Waveform restored from saved project — attach audio for playback."
          : null;

  return (
    <div className="space-y-3">
      <div>
        <div className="mb-1 flex justify-between text-[10px] text-white/40">
          <span>Full track</span>
          <span className="font-mono text-white/55">
            {formatTime(0)} – {formatTime(duration)}
          </span>
        </div>
        <WaveformStrip
          peaks={peaks}
          duration={duration}
          highlightStart={highlightStart}
          highlightEnd={highlightEnd}
          playhead={playhead}
          mode="full"
          onSeek={audioUrl ? onSeek : undefined}
        />
      </div>
      <div>
        <div className="mb-1 flex justify-between text-[10px] text-amber-200/80">
          <span>Highlight range</span>
          <span className="font-mono">
            {formatTime(highlightStart)} – {formatTime(highlightEnd)}
          </span>
        </div>
        <WaveformStrip
          peaks={highlightPeaks}
          duration={duration}
          highlightStart={highlightStart}
          highlightEnd={highlightEnd}
          playhead={playhead}
          mode="highlight"
          onSeek={audioUrl ? onSeek : undefined}
        />
        <p className="mt-1 text-[10px] text-white/35">Click waveform to seek · amber = detected peak section</p>
        {sourceNote ? <p className="text-[10px] text-amber-200/55">{sourceNote}</p> : null}
      </div>
    </div>
  );
}
