"use client";

import { memo, useEffect, useRef, useState } from "react";
import { formatTime } from "../lib/audio-analyzer";

/**
 * Normalize analysis.vocalRegions + highlight into a list for WaveSurfer.
 * @param {object|null|undefined} analysis
 * @returns {{ id: string, start: number, end: number, color: string }[]}
 */
export function buildWaveformRegionSpecs(analysis) {
  const duration = Number(analysis?.duration) || 0;
  const regions = [];
  const hiStart = Math.max(0, Number(analysis?.highlightStart) || 0);
  const hiEnd = Math.max(hiStart + 0.1, Number(analysis?.highlightEnd) || duration || hiStart + 8);
  regions.push({
    id: "highlight",
    start: hiStart,
    end: hiEnd,
    color: "rgba(251, 191, 36, 0.22)",
  });
  const extras = Array.isArray(analysis?.vocalRegions) ? analysis.vocalRegions : [];
  extras.forEach((r, i) => {
    const id = String(r?.id || `region-${i + 1}`);
    if (id === "highlight") return;
    const start = Math.max(0, Number(r?.start) || 0);
    const end = Math.max(start + 0.1, Number(r?.end) || start + 4);
    regions.push({
      id,
      start,
      end,
      color: "rgba(167, 139, 250, 0.22)",
    });
  });
  return regions;
}

/**
 * WaveSurfer.js highlight + multi-region editor (default). Classic canvas via toggle.
 * Boot only on audioUrl / duration — highlight drag must not destroy/recreate the instance.
 */
export const AudioWaveformProPrototype = memo(function AudioWaveformProPrototype({
  audioUrl,
  analysis,
  onHighlightChange,
}) {
  const containerRef = useRef(null);
  const waveRef = useRef(null);
  const regionsRef = useRef(null);
  const onHighlightChangeRef = useRef(onHighlightChange);
  const regionSeqRef = useRef(1);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    onHighlightChangeRef.current = onHighlightChange;
  }, [onHighlightChange]);

  const emitRegions = (regionsPlugin, wavesurfer) => {
    if (!regionsPlugin || !onHighlightChangeRef.current) return;
    const duration = wavesurfer?.getDuration?.() || analysis?.duration || 0;
    const all = regionsPlugin.getRegions?.() || [];
    const highlight = all.find((r) => r.id === "highlight");
    const vocalRegions = all
      .filter((r) => r.id !== "highlight")
      .map((r) => ({
        id: String(r.id),
        start: r.start,
        end: r.end,
      }));
    const patch = { vocalRegions };
    if (highlight) {
      patch.highlightStart = highlight.start;
      patch.highlightEnd = highlight.end;
      patch.highlightLabel = "WaveSurfer region highlight";
    } else if (duration > 0) {
      patch.highlightStart = 0;
      patch.highlightEnd = Math.min(8, duration);
    }
    onHighlightChangeRef.current(patch);
  };

  useEffect(() => {
    let cancelled = false;
    let regionsPlugin = null;

    async function boot() {
      if (!audioUrl || !containerRef.current) return;
      setStatus("loading");
      try {
        const [{ default: WaveSurfer }, { default: RegionsPlugin }, { default: TimelinePlugin }] =
          await Promise.all([
            import("wavesurfer.js"),
            import("wavesurfer.js/dist/plugins/regions.esm.js"),
            import("wavesurfer.js/dist/plugins/timeline.esm.js"),
          ]);
        if (cancelled || !containerRef.current) return;

        const wavesurfer = WaveSurfer.create({
          container: containerRef.current,
          url: audioUrl,
          height: 96,
          waveColor: "rgba(103, 232, 249, 0.45)",
          progressColor: "rgba(251, 146, 60, 0.85)",
          cursorColor: "rgba(255, 255, 255, 0.8)",
          barWidth: 2,
          barGap: 1,
          normalize: true,
        });
        const timeline = wavesurfer.registerPlugin(TimelinePlugin.create());
        regionsPlugin = wavesurfer.registerPlugin(RegionsPlugin.create());
        waveRef.current = { wavesurfer, timeline };
        regionsRef.current = regionsPlugin;

        wavesurfer.on("ready", () => {
          if (cancelled) return;
          const duration = wavesurfer.getDuration() || analysis?.duration || 0;
          regionsPlugin.clearRegions();
          for (const spec of buildWaveformRegionSpecs({ ...analysis, duration })) {
            const start = Math.max(0, Math.min(spec.start, duration));
            const end = Math.max(start + 0.1, Math.min(spec.end, duration || spec.end));
            regionsPlugin.addRegion({
              id: spec.id,
              start,
              end,
              color: spec.color,
              drag: true,
              resize: true,
            });
          }
          setStatus("ready");
        });

        wavesurfer.on("error", (err) => {
          if (!cancelled) setStatus(`unavailable: ${String(err?.message || err).slice(0, 80)}`);
        });

        const onRegionChange = () => emitRegions(regionsPlugin, wavesurfer);
        regionsPlugin.on("region-updated", onRegionChange);
        regionsPlugin.on("region-created", onRegionChange);
        regionsPlugin.on("region-removed", onRegionChange);
      } catch (err) {
        if (!cancelled) setStatus(`unavailable: ${String(err?.message || err).slice(0, 80)}`);
      }
    }

    void boot();
    return () => {
      cancelled = true;
      const current = waveRef.current;
      waveRef.current = null;
      regionsRef.current = null;
      current?.wavesurfer?.destroy();
    };
    // Intentionally omit highlightStart/End and onHighlightChange — remounting on drag was the bug.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- analysis duration used only for initial region seed
  }, [audioUrl, analysis?.duration]);

  // Sync highlight region when it changes from outside (classic presets / energy strip).
  useEffect(() => {
    const regionsPlugin = regionsRef.current;
    const wavesurfer = waveRef.current?.wavesurfer;
    if (!regionsPlugin || !wavesurfer || status !== "ready") return;
    const duration = wavesurfer.getDuration() || analysis?.duration || 0;
    if (!(duration > 0)) return;
    const start = Math.max(0, Math.min(analysis?.highlightStart || 0, duration));
    const end = Math.max(start + 0.1, Math.min(analysis?.highlightEnd || duration, duration));
    const existing = regionsPlugin.getRegions?.()?.find((r) => r.id === "highlight");
    if (existing) {
      const eps = 0.02;
      if (Math.abs(existing.start - start) < eps && Math.abs(existing.end - end) < eps) return;
      existing.setOptions({ start, end });
    }
  }, [analysis?.highlightStart, analysis?.highlightEnd, analysis?.duration, status]);

  const addRegion = () => {
    const regionsPlugin = regionsRef.current;
    const wavesurfer = waveRef.current?.wavesurfer;
    if (!regionsPlugin || !wavesurfer || status !== "ready") return;
    const duration = wavesurfer.getDuration() || analysis?.duration || 0;
    if (!(duration > 0)) return;
    const cursor = wavesurfer.getCurrentTime?.() || 0;
    const start = Math.max(0, Math.min(cursor, Math.max(0, duration - 4)));
    const end = Math.min(duration, start + 4);
    const id = `region-${regionSeqRef.current++}`;
    regionsPlugin.addRegion({
      id,
      start,
      end,
      color: "rgba(167, 139, 250, 0.22)",
      drag: true,
      resize: true,
    });
    emitRegions(regionsPlugin, wavesurfer);
  };

  const clearExtraRegions = () => {
    const regionsPlugin = regionsRef.current;
    const wavesurfer = waveRef.current?.wavesurfer;
    if (!regionsPlugin || !wavesurfer) return;
    for (const r of regionsPlugin.getRegions?.() || []) {
      if (r.id !== "highlight") r.remove();
    }
    emitRegions(regionsPlugin, wavesurfer);
  };

  if (!audioUrl) return null;

  const extraCount = Array.isArray(analysis?.vocalRegions) ? analysis.vocalRegions.length : 0;

  return (
    <section className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-3">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-100">
          WaveSurfer regions
        </div>
        <div className="font-mono text-[10px] text-white/45">
          HL {formatTime(analysis?.highlightStart || 0)} – {formatTime(analysis?.highlightEnd || 0)}
          {extraCount ? ` · +${extraCount} region${extraCount === 1 ? "" : "s"}` : ""}
        </div>
      </div>
      <div ref={containerRef} className="overflow-hidden rounded-xl bg-black/35" />
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={status !== "ready"}
          onClick={(e) => {
            e.preventDefault();
            addRegion();
          }}
          className="rounded-lg border border-cyan-400/35 bg-cyan-500/15 px-2 py-1 text-[10px] font-bold text-cyan-50 hover:bg-cyan-500/25 disabled:opacity-50"
        >
          Add region
        </button>
        <button
          type="button"
          disabled={status !== "ready" || extraCount === 0}
          onClick={(e) => {
            e.preventDefault();
            clearExtraRegions();
          }}
          className="rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-[10px] font-semibold text-white/60 hover:text-white disabled:opacity-50"
        >
          Clear extra regions
        </button>
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-white/45">
        Amber = merge highlight. Violet = extra vocal-transform regions. Toggle classic via the
        Highlight section button or set `NEXT_PUBLIC_WAVESURFER_PROTOTYPE=0`.
      </p>
      {status !== "ready" ? <p className="mt-1 text-[10px] text-white/35">{status}</p> : null}
    </section>
  );
});
