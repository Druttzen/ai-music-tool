"use client";

import { memo, useEffect, useRef, useState } from "react";
import { formatTime } from "../lib/audio-analyzer";

/**
 * WaveSurfer.js highlight editor (default). Classic canvas editor available via toggle.
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
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    onHighlightChangeRef.current = onHighlightChange;
  }, [onHighlightChange]);

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
          const start = Math.max(0, Math.min(analysis?.highlightStart || 0, duration));
          const end = Math.max(start + 0.1, Math.min(analysis?.highlightEnd || duration, duration));
          regionsPlugin.clearRegions();
          regionsPlugin.addRegion({
            id: "highlight",
            start,
            end,
            color: "rgba(251, 191, 36, 0.22)",
            drag: true,
            resize: true,
          });
          setStatus("ready");
        });

        wavesurfer.on("error", (err) => {
          if (!cancelled) setStatus(`unavailable: ${String(err?.message || err).slice(0, 80)}`);
        });

        regionsPlugin.on("region-updated", (region) => {
          if (region.id !== "highlight") return;
          onHighlightChangeRef.current?.({
            highlightStart: region.start,
            highlightEnd: region.end,
            highlightLabel: "WaveSurfer region highlight",
          });
        });
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

  // Sync region when highlight changes from outside (classic presets / merge), without remount.
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

  if (!audioUrl) return null;

  return (
    <section className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-3">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-100">
          WaveSurfer prototype
        </div>
        <div className="font-mono text-[10px] text-white/45">
          {formatTime(analysis?.highlightStart || 0)} – {formatTime(analysis?.highlightEnd || 0)}
        </div>
      </div>
      <div ref={containerRef} className="overflow-hidden rounded-xl bg-black/35" />
      <p className="mt-2 text-[10px] leading-relaxed text-white/45">
        Pro waveform (WaveSurfer) is on by default. Toggle classic via the Highlight section
        button (localStorage) or set `NEXT_PUBLIC_WAVESURFER_PROTOTYPE=0`.
      </p>
      {status !== "ready" ? <p className="mt-1 text-[10px] text-white/35">{status}</p> : null}
    </section>
  );
});
