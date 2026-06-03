"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  formatTime,
  normalizeHighlightRange,
  sliceWaveformPeaksForRange,
} from "../lib/audio-analyzer";

const MIN_HIGHLIGHT_SEC = 2;

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * @param {object} props
 * @param {number[]} props.peaks
 * @param {number} props.duration
 * @param {number} props.highlightStart
 * @param {number} props.highlightEnd
 * @param {number|null} props.playhead
 * @param {"full"|"highlight"} props.mode
 * @param {(time: number) => void} [props.onSeek]
 * @param {(range: { highlightStart: number, highlightEnd: number }) => void} [props.onHighlightChange]
 */
function WaveformStrip({
  peaks,
  duration,
  highlightStart,
  highlightEnd,
  playhead,
  mode,
  onSeek,
  onHighlightChange,
}) {
  const trackRef = useRef(null);
  const dragEdgeRef = useRef(null);
  const rangeRef = useRef({ start: 0, end: 0 });

  const hasPeaks = Boolean(peaks?.length);
  const dur = Math.max(0.001, duration || 0);
  const hStart = Math.max(0, Math.min(dur, highlightStart ?? 0));
  const hEnd = Math.max(hStart, Math.min(dur, highlightEnd ?? dur));
  const isHighlightView = mode === "highlight";
  const draggable = Boolean(onHighlightChange && !isHighlightView && hasPeaks);

  useEffect(() => {
    rangeRef.current = { start: hStart, end: hEnd };
  }, [hStart, hEnd]);

  const timeFromClientX = useCallback(
    (clientX) => {
      const el = trackRef.current;
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
      return ratio * dur;
    },
    [dur],
  );

  const emitRange = useCallback(
    (start, end) => {
      if (!onHighlightChange) return;
      const norm = normalizeHighlightRange(dur, start, end, MIN_HIGHLIGHT_SEC);
      onHighlightChange(norm);
    },
    [dur, onHighlightChange],
  );

  useEffect(() => {
    if (!draggable) return undefined;

    const onMove = (e) => {
      const edge = dragEdgeRef.current;
      if (!edge) return;
      const t = timeFromClientX(e.clientX);
      const { start, end } = rangeRef.current;
      if (edge === "start") emitRange(t, end);
      else if (edge === "end") emitRange(start, t);
    };

    const onUp = () => {
      dragEdgeRef.current = null;
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [draggable, emitRange, timeFromClientX]);

  const handleSeekClick = (e) => {
    if (dragEdgeRef.current) return;
    if (e.target.closest("[data-highlight-handle]")) return;
    e.preventDefault();
    e.stopPropagation();
    if (!onSeek) return;
    const t = timeFromClientX(e.clientX);
    if (isHighlightView) {
      const span = hEnd - hStart;
      onSeek(hStart + clamp((t - hStart) / span, 0, 1) * span);
    } else {
      onSeek(t);
    }
  };

  const handleStartPointerDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragEdgeRef.current = "start";
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const handleEndPointerDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragEdgeRef.current = "end";
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  if (!hasPeaks) {
    return (
      <div className="flex h-16 items-center justify-center rounded-xl border border-white/10 bg-black/40 px-2 text-center text-[10px] text-white/35">
        Building waveform…
      </div>
    );
  }

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
    <div
      ref={trackRef}
      role="presentation"
      onClick={handleSeekClick}
      className={`relative block w-full rounded-xl border border-white/10 bg-black/50 p-1 ${onSeek ? "cursor-pointer" : ""}`}
    >
      <div className="relative flex h-16 items-end gap-px overflow-hidden rounded-lg px-0.5">
        {!isHighlightView ? (
          <div
            className={`absolute inset-y-1 z-[3] rounded-md border border-amber-400/45 bg-amber-400/15 ${draggable ? "pointer-events-auto" : "pointer-events-none"}`}
            style={{ left: `${highlightLeft}%`, width: `${highlightWidth}%` }}
            title={`Highlight ${formatTime(hStart)} – ${formatTime(hEnd)}`}
          >
            {draggable ? (
              <>
                <div
                  data-highlight-handle="start"
                  role="slider"
                  aria-label="Highlight start"
                  aria-valuemin={0}
                  aria-valuemax={Math.round(dur)}
                  aria-valuenow={Math.round(hStart)}
                  onPointerDown={handleStartPointerDown}
                  className="absolute inset-y-0 left-0 z-[4] w-2 -translate-x-1/2 cursor-ew-resize rounded-full bg-amber-300 shadow-[0_0_8px_rgba(251,191,36,0.8)]"
                />
                <div
                  data-highlight-handle="end"
                  role="slider"
                  aria-label="Highlight end"
                  aria-valuemin={0}
                  aria-valuemax={Math.round(dur)}
                  aria-valuenow={Math.round(hEnd)}
                  onPointerDown={handleEndPointerDown}
                  className="absolute inset-y-0 right-0 z-[4] w-2 translate-x-1/2 cursor-ew-resize rounded-full bg-amber-300 shadow-[0_0_8px_rgba(251,191,36,0.8)]"
                />
              </>
            ) : null}
          </div>
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
    </div>
  );
}

/**
 * Full-track + highlight-zoom waveforms synced to the preview player.
 */
export function AudioHighlightWaveform({ analysis, audioUrl, onSeek, playhead, onHighlightChange }) {
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
          onHighlightChange={onHighlightChange}
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
        <p className="mt-1 text-[10px] text-white/35">
          {onHighlightChange
            ? "Drag amber handles on the full track · click to seek"
            : "Click waveform to seek · amber = peak section"}
        </p>
        {sourceNote ? <p className="text-[10px] text-amber-200/55">{sourceNote}</p> : null}
      </div>
    </div>
  );
}
