"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatLufs } from "../lib/lufs-meter";
import { formatCorrelation } from "../lib/stereo-phase";
import {
  defaultPreviewEqState,
  gainToMatchLufs,
  loadPreviewEqState,
  measureIntegratedLufsFromBytes,
  savePreviewEqState,
} from "../lib/preview-monitor";

const SPECTRUM_BINS = 48;

/**
 * Preview monitoring: phase readout, A/B reference, live spectrum, headphone EQ.
 * EQ and A/B affect preview only — never export.
 */
export function PreviewMonitorStrip({ audioUrl = null, stereoPhase = null, programLufs = null }) {
  const audioRef = useRef(null);
  const refAudioRef = useRef(null);
  const ctxRef = useRef(null);
  const analyserRef = useRef(null);
  const eqNodesRef = useRef([]);
  const sourceNodesRef = useRef({ program: null, reference: null });
  const gainProgramRef = useRef(null);
  const gainReferenceRef = useRef(null);
  const rafRef = useRef(0);

  const [abMode, setAbMode] = useState("A");
  const [refUrl, setRefUrl] = useState(null);
  const [refName, setRefName] = useState("");
  const [refLufs, setRefLufs] = useState(null);
  const [refEngine, setRefEngine] = useState(null);
  const [refBusy, setRefBusy] = useState(false);
  const [spectrum, setSpectrum] = useState(() => new Array(SPECTRUM_BINS).fill(0));
  const [eqState, setEqState] = useState(() =>
    typeof window === "undefined" ? defaultPreviewEqState() : loadPreviewEqState(),
  );
  const eqStateRef = useRef(eqState);

  const matchGain = useMemo(
    () => gainToMatchLufs(programLufs ?? NaN, refLufs ?? NaN),
    [programLufs, refLufs],
  );

  const ensureGraph = useCallback(async () => {
    if (typeof window === "undefined") return null;
    if (!ctxRef.current) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      ctxRef.current = new Ctx();
    }
    const ctx = ctxRef.current;
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {
        /* ignore */
      }
    }

    if (!analyserRef.current) {
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.7;
      analyserRef.current = analyser;

      const programGain = ctx.createGain();
      const referenceGain = ctx.createGain();
      gainProgramRef.current = programGain;
      gainReferenceRef.current = referenceGain;

      const bands = [];
      let tail = programGain;
      for (let i = 0; i < 5; i++) {
        const f = ctx.createBiquadFilter();
        f.type = i === 0 ? "lowshelf" : i === 4 ? "highshelf" : "peaking";
        bands.push(f);
        tail.connect(f);
        tail = f;
      }
      eqNodesRef.current = bands;
      tail.connect(analyser);
      referenceGain.connect(analyser);
      analyser.connect(ctx.destination);
    }
    return ctx;
  }, []);

  const applyEqToNodes = useCallback((state) => {
    const bands = eqNodesRef.current;
    if (!bands.length) return;
    state.bands.forEach((band, i) => {
      const node = bands[i];
      if (!node) return;
      node.frequency.value = band.freq;
      node.Q.value = band.q;
      node.gain.value = state.enabled ? band.gain : 0;
    });
  }, []);

  useEffect(() => {
    eqStateRef.current = eqState;
    applyEqToNodes(eqState);
    savePreviewEqState(eqState);
  }, [eqState, applyEqToNodes]);

  useEffect(() => {
    if (!audioUrl) return undefined;

    let cancelled = false;

    (async () => {
      const ctx = await ensureGraph();
      if (!ctx || cancelled) return;
      applyEqToNodes(eqStateRef.current);

      const programEl = audioRef.current;
      const refEl = refAudioRef.current;
      if (!programEl) return;

      if (!sourceNodesRef.current.program) {
        try {
          sourceNodesRef.current.program = ctx.createMediaElementSource(programEl);
          sourceNodesRef.current.program.connect(gainProgramRef.current);
        } catch {
          /* already connected */
        }
      }

      if (refEl && refUrl && !sourceNodesRef.current.reference) {
        try {
          sourceNodesRef.current.reference = ctx.createMediaElementSource(refEl);
          sourceNodesRef.current.reference.connect(gainReferenceRef.current);
        } catch {
          /* already connected */
        }
      }

      const tick = () => {
        const analyser = analyserRef.current;
        if (!analyser) return;
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        const bins = new Array(SPECTRUM_BINS);
        const step = data.length / SPECTRUM_BINS;
        for (let i = 0; i < SPECTRUM_BINS; i++) {
          const idx = Math.min(data.length - 1, Math.floor(i * step));
          bins[i] = data[idx] / 255;
        }
        setSpectrum(bins);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    })();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [audioUrl, refUrl, ensureGraph, applyEqToNodes]);

  useEffect(() => {
    const program = audioRef.current;
    const reference = refAudioRef.current;
    if (!program || !reference) return undefined;

    const syncFromProgram = () => {
      try {
        reference.currentTime = program.currentTime;
      } catch {
        /* ignore */
      }
      if (!program.paused) {
        reference.play().catch(() => {});
      } else {
        reference.pause();
      }
    };
    const onPause = () => reference.pause();
    program.addEventListener("play", syncFromProgram);
    program.addEventListener("pause", onPause);
    program.addEventListener("seeked", syncFromProgram);
    return () => {
      program.removeEventListener("play", syncFromProgram);
      program.removeEventListener("pause", onPause);
      program.removeEventListener("seeked", syncFromProgram);
    };
  }, [refUrl, audioUrl]);

  useEffect(() => {
    const programGain = gainProgramRef.current;
    const referenceGain = gainReferenceRef.current;
    if (!programGain || !referenceGain) return;
    const hearA = abMode === "A";
    programGain.gain.value = hearA ? 1 : 0;
    referenceGain.gain.value = hearA ? 0 : matchGain;
  }, [abMode, matchGain]);

  useEffect(() => {
    return () => {
      if (refUrl) URL.revokeObjectURL(refUrl);
      try {
        ctxRef.current?.close();
      } catch {
        /* ignore */
      }
      ctxRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- revoke only on unmount
  }, []);

  const onPickReference = async (file) => {
    if (!file) return;
    setRefBusy(true);
    try {
      if (refUrl) URL.revokeObjectURL(refUrl);
      sourceNodesRef.current.reference = null;
      const url = URL.createObjectURL(file);
      setRefUrl(url);
      setRefName(file.name);
      // Studio: Symphonia via dsp-bridge (MP3/M4A/OGG/FLAC/WAV). Browser: Web Audio.
      const measured = await measureIntegratedLufsFromBytes(await file.arrayBuffer());
      setRefLufs(measured.integratedLUFS);
      setRefEngine(measured.engine);
      setAbMode("B");
    } catch {
      setRefLufs(null);
      setRefEngine(null);
    } finally {
      setRefBusy(false);
    }
  };

  const clearReference = () => {
    if (refUrl) URL.revokeObjectURL(refUrl);
    setRefUrl(null);
    setRefName("");
    setRefLufs(null);
    setRefEngine(null);
    setAbMode("A");
    sourceNodesRef.current.reference = null;
  };

  const toggleAb = useCallback(() => {
    if (!refUrl) return;
    setAbMode((m) => (m === "A" ? "B" : "A"));
  }, [refUrl]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "\\") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (!refUrl) return;
      e.preventDefault();
      toggleAb();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [refUrl, toggleAb]);

  if (!audioUrl) return null;

  return (
    <section className="rounded-2xl border border-cyan-400/25 bg-cyan-500/10 p-3 space-y-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-100/90">
        Preview monitor
      </div>

      {stereoPhase ? (
        <div className="text-[11px] text-white/70">
          Correlation {formatCorrelation(stereoPhase.correlation)}
          {" · "}
          Mono cancel {Number.isFinite(stereoPhase.monoCancelDb)
            ? `${stereoPhase.monoCancelDb.toFixed(1)} dB`
            : "—"}
          {stereoPhase.outOfPhase ? (
            <span className="ml-2 font-bold text-amber-200">Mono warning — check phase / Wide</span>
          ) : null}
        </div>
      ) : (
        <div className="text-[11px] text-white/40">Phase meter loads with loudness measure</div>
      )}

      <div className="space-y-1">
        <div className="text-[10px] font-bold uppercase tracking-wider text-white/50">
          Live spectrum
        </div>
        <div className="flex h-12 items-end gap-px rounded-lg bg-black/35 px-1 py-1">
          {spectrum.map((v, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm bg-cyan-300/80"
              style={{ height: `${Math.max(4, v * 100)}%` }}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <label className="cursor-pointer rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-[10px] font-bold text-white/70 hover:bg-black/45">
            Attach A/B reference
            <input
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) onPickReference(f);
              }}
            />
          </label>
          {refUrl ? (
            <>
              <button
                type="button"
                onClick={toggleAb}
                className="rounded-lg border border-cyan-400/40 bg-cyan-500/20 px-2 py-1 text-[10px] font-bold text-cyan-50"
              >
                Hear {abMode === "A" ? "A (track)" : "B (ref)"} — press \
              </button>
              <button
                type="button"
                onClick={clearReference}
                className="rounded-lg border border-white/10 px-2 py-1 text-[10px] text-white/50"
              >
                Clear ref
              </button>
            </>
          ) : null}
        </div>
        <p className="text-[10px] text-white/40">
          {refBusy
            ? "Measuring reference LUFS (Symphonia in Studio)…"
            : refUrl
              ? `${refName} · ref ${formatLufs(refLufs)}${refEngine === "native" ? " · native" : ""} · matched gain ${matchGain.toFixed(2)}× (preview only)`
              : "Drop a reference to A/B at matched integrated LUFS (Symphonia decode in Studio) — honest mix check, not Atmos/DTS."}
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-white/50">
            Preview EQ — not Atmos / not DTS
          </div>
          <label className="flex items-center gap-1.5 text-[10px] text-white/60">
            <input
              type="checkbox"
              checked={eqState.enabled}
              onChange={(e) => setEqState((s) => ({ ...s, enabled: e.target.checked }))}
            />
            Enable (preview only)
          </label>
        </div>
        <div className="grid gap-2 sm:grid-cols-5">
          {eqState.bands.map((band, i) => (
            <label key={band.freq} className="block text-[10px] text-white/45">
              {band.freq >= 1000 ? `${band.freq / 1000}k` : band.freq} Hz
              <input
                type="range"
                min={-12}
                max={12}
                step={0.5}
                value={band.gain}
                disabled={!eqState.enabled}
                onChange={(e) => {
                  const gain = Number(e.target.value);
                  setEqState((s) => ({
                    ...s,
                    bands: s.bands.map((b, j) => (j === i ? { ...b, gain } : b)),
                  }));
                }}
                className="mt-1 w-full"
              />
              <span className="text-white/55">{band.gain > 0 ? "+" : ""}
                {band.gain} dB
              </span>
            </label>
          ))}
        </div>
      </div>

      <audio ref={audioRef} src={audioUrl} controls preload="metadata" className="w-full" />
      {refUrl ? (
        <audio ref={refAudioRef} src={refUrl} preload="metadata" className="hidden" />
      ) : null}
    </section>
  );
}
