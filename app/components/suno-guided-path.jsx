"use client";

import React, { useCallback, useEffect, useMemo, useState, memo } from "react";
import { Panel } from "./ui-blocks";
import {
  buildSunoPastedLyricsField,
  buildSunoPastedStyleLine,
  FACTORY_PRESET_BLURBS,
  getProgressiveStyleFragment,
  getSunoStylePreviewHint,
  getGuidedPolishStepIndex,
  getStepCount,
  SUNO_GUIDED_STEPS,
} from "../lib/suno-guided-workflow";
import { stylePresets } from "../lib/music-config";
import {
  SUNO_LIMITS_NOTE,
  SUNO_LYRICS_CHAR_TYPICAL_MAX,
  SUNO_LYRICS_CHAR_WARN,
  SUNO_STYLE_CHAR_CAP,
} from "../lib/suno-limits";

export const SunoGuidedPath = memo(function SunoGuidedPath({
  promptEngine,
  onSelectSunoEngine,
  input,
  copyToClipboard,
  setStatusWithTime,
  vocal = "Instrumental",
  instrumentalVocalFx = false,
  setVocal,
  setInstrumentalVocalFx,
  customPresets = {},
  onApplyFactoryPreset,
  onLoadCustomPreset,
  guidedStep: guidedStepProp,
  setGuidedStep: setGuidedStepProp,
}) {
  const [internalStep, setInternalStep] = useState(0);
  const controlled =
    typeof setGuidedStepProp === "function" && typeof guidedStepProp === "number";
  const rawStep = controlled ? guidedStepProp : internalStep;

  const total = getStepCount();
  const lastIndex = total - 1;
  const polishStepIndex = getGuidedPolishStepIndex();

  const setStep = useCallback(
    (updater) => {
      const clampIdx = (n) => Math.min(lastIndex, Math.max(0, n));
      if (controlled) {
        setGuidedStepProp((prev) => {
          const p = typeof prev === "number" && !Number.isNaN(prev) ? prev : 0;
          const next = typeof updater === "function" ? updater(p) : updater;
          const n = typeof next === "number" && !Number.isNaN(next) ? next : 0;
          return clampIdx(n);
        });
      } else {
        setInternalStep((prev) => {
          const p = typeof prev === "number" && !Number.isNaN(prev) ? prev : 0;
          const next = typeof updater === "function" ? updater(p) : updater;
          const n = typeof next === "number" && !Number.isNaN(next) ? next : 0;
          return clampIdx(n);
        });
      }
    },
    [controlled, lastIndex, setGuidedStepProp],
  );

  /** Keep step index aligned with SUNO_GUIDED_STEPS (handles bad persisted values). */
  useEffect(() => {
    if (!controlled || typeof setGuidedStepProp !== "function") return;
    if (typeof guidedStepProp !== "number" || Number.isNaN(guidedStepProp)) {
      setGuidedStepProp(0);
      return;
    }
    if (guidedStepProp < 0 || guidedStepProp > lastIndex) {
      setGuidedStepProp(Math.min(lastIndex, Math.max(0, guidedStepProp)));
    }
  }, [controlled, guidedStepProp, lastIndex, setGuidedStepProp]);

  const step = Math.min(
    lastIndex,
    Math.max(0, typeof rawStep !== "number" || Number.isNaN(rawStep) ? 0 : rawStep),
  );

  const p = input;
  const progressive = useMemo(() => getProgressiveStyleFragment(p, step), [p, step]);
  const stylePreviewHint = useMemo(() => getSunoStylePreviewHint(step), [step]);
  const finalStyle = useMemo(() => buildSunoPastedStyleLine(p), [p]);
  const finalLyrics = useMemo(() => buildSunoPastedLyricsField(p), [p]);
  const cur = SUNO_GUIDED_STEPS[step];

  if (promptEngine !== "Suno-like") {
    return (
      <Panel
        title="Suno — guided path"
        hint="Eight guided steps + final Style/Lyrics paste (1000-char Style cap); step 1 ties to Style Presets."
      >
        <p className="text-sm text-white/70">
          Set <strong className="text-cyan-200">Prompt Engine</strong> in Co-Producer to{" "}
          <strong className="text-cyan-200">Suno-like</strong> to unlock the step list and
          one-click copy blocks built for Suno.
        </p>
        {onSelectSunoEngine ? (
          <button
            type="button"
            onClick={onSelectSunoEngine}
            className="mt-3 w-full rounded-2xl bg-cyan-300 py-2.5 text-sm font-bold text-black hover:bg-cyan-200"
          >
            Switch to Suno-like
          </button>
        ) : null}
      </Panel>
    );
  }

  return (
    <Panel
      title={`Suno path — ${cur.name} (${step + 1} / ${total})`}
      hint="Jump any step from the row below; load presets on step 1. Style preview builds in layers — final paste reorders for Suno."
    >
      <nav className="mt-1 flex flex-wrap gap-1" aria-label="Suno guided steps">
        {SUNO_GUIDED_STEPS.map((s, i) => {
          const active = i === step;
          return (
            <button
              key={s.id}
              type="button"
              title={s.name}
              onClick={() => {
                if (i === step) return;
                setStep(i);
                setStatusWithTime(`Suno step ${i + 1}: ${s.name}`, "info");
              }}
              className={
                "min-w-[1.75rem] rounded-lg px-1.5 py-0.5 text-center text-[10px] font-bold transition " +
                (active
                  ? "bg-cyan-300 text-black ring-1 ring-cyan-200/80"
                  : "bg-white/5 text-white/55 ring-1 ring-white/10 hover:bg-white/10 hover:text-white/80")
              }
            >
              {i + 1}
            </button>
          );
        })}
      </nav>
      <p className="mt-3 text-sm font-bold leading-snug text-cyan-100">{cur.line}</p>
      <p className="mt-1 text-xs text-white/50">
        <span className="font-bold text-white/60">Where in this app: </span>
        {cur.where}
      </p>
      <p className="mt-2 text-sm text-amber-100/90">
        <span className="font-bold">Next: </span>
        {cur.next}
      </p>
      <p className="mt-1 text-xs text-emerald-200/90">
        <span className="font-bold">Optimal success: </span>
        {cur.optimal}
      </p>

      {step === polishStepIndex ? (
        <p className="mt-2 rounded-xl border border-white/10 bg-black/30 p-2 text-[10px] leading-relaxed text-white/50">
          <span className="font-bold text-cyan-200/90">Optional here: </span>
          Audio and image analyzers are not required. You can go straight to{" "}
          <span className="text-white/65">Next step</span> → final copy whenever you’re ready.
        </p>
      ) : null}

      {step === 0 && typeof setVocal === "function" ? (
        <div className="mt-4 space-y-3 rounded-2xl border border-orange-400/30 bg-orange-500/10 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-orange-200/90">
            Will this track have lyrics or be instrumental?
          </div>
          <p className="text-[10px] leading-relaxed text-white/45">
            This sets the vocal mode for the whole project. You can still change the vocal chip in Music
            Controls later. For instrumental + texture only, use Vocal FX (not full lyrics).
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setVocal("Female Lead");
                setInstrumentalVocalFx?.(false);
                setStatusWithTime("Guided path: lyrics (Female Lead) — change vocal chip in Music Controls if you want");
              }}
              className={
                "rounded-xl px-4 py-2 text-xs font-bold transition " +
                (vocal !== "Instrumental"
                  ? "bg-cyan-300 text-black ring-1 ring-cyan-200/80"
                  : "border border-white/15 bg-black/40 text-cyan-100 hover:border-cyan-300/40")
              }
            >
              Lyrics
            </button>
            <button
              type="button"
              onClick={() => {
                setVocal("Instrumental");
                setStatusWithTime("Guided path: instrumental");
              }}
              className={
                "rounded-xl px-4 py-2 text-xs font-bold transition " +
                (vocal === "Instrumental"
                  ? "bg-cyan-300 text-black ring-1 ring-cyan-200/80"
                  : "border border-white/15 bg-black/40 text-cyan-100 hover:border-cyan-300/40")
              }
            >
              Instrumental
            </button>
          </div>
          {vocal === "Instrumental" && typeof setInstrumentalVocalFx === "function" ? (
            <label className="flex cursor-pointer items-start gap-2 text-[11px] text-white/80">
              <input
                type="checkbox"
                checked={instrumentalVocalFx}
                onChange={(e) => {
                  setInstrumentalVocalFx(e.target.checked);
                  setStatusWithTime(
                    e.target.checked
                      ? "Vocal FX on: texture/chops only (no lyrics)"
                      : "Vocal FX off: strict instrumental",
                  );
                }}
                className="mt-0.5 h-3.5 w-3.5 rounded border-white/30"
              />
              <span>
                <span className="font-bold text-orange-200/90">Vocal FX</span> — allow chopped vocal
                textures, one-shots, and FX (not sung lyrics or verses)
              </span>
            </label>
          ) : null}
        </div>
      ) : null}

      {cur.preset ? (
        <div className="mt-4 space-y-3 rounded-2xl border border-cyan-400/25 bg-cyan-950/25 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-200/90">
            Same presets as the left column — tap to load, then refine in later steps
          </div>
          <div className="grid gap-2">
            {Object.keys(stylePresets).map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => onApplyFactoryPreset?.(name)}
                className="rounded-xl border border-white/10 bg-black/40 p-2.5 text-left text-xs font-bold text-cyan-100 hover:border-cyan-300/45 hover:bg-black/55"
              >
                <span className="block">{name}</span>
                {FACTORY_PRESET_BLURBS[name] ? (
                  <span className="mt-0.5 block font-normal leading-snug text-white/45">{FACTORY_PRESET_BLURBS[name]}</span>
                ) : null}
              </button>
            ))}
          </div>
          {Object.keys(customPresets).length > 0 ? (
            <>
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/50">Custom presets</div>
              <div className="flex flex-wrap gap-2">
                {Object.keys(customPresets).map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => onLoadCustomPreset?.(name)}
                    className="rounded-full border border-fuchsia-400/35 bg-fuchsia-500/10 px-3 py-1.5 text-[11px] font-bold text-fuchsia-100 hover:bg-fuchsia-500/20"
                  >
                    {name}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="text-[10px] leading-relaxed text-white/40">
              Save a style under &quot;Save Current As Preset&quot; in the left column — it will show here for one-tap load.
            </p>
          )}
        </div>
      ) : null}

      <div className="mt-3 rounded-2xl border border-white/10 bg-black/40 p-3">
        <div className="text-[10px] font-bold uppercase tracking-wider text-white/45">Live Style preview</div>
        <p className="mt-0.5 text-[10px] leading-snug text-white/40">{stylePreviewHint}</p>
        {step < lastIndex ? (
          <p className="mt-2 break-words text-[11px] font-mono leading-relaxed text-cyan-50/90">
            {progressive || "—"}
          </p>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={step === 0}
          onClick={() => {
            const next = Math.max(0, step - 1);
            if (next === step) return;
            setStep(next);
            setStatusWithTime(`Suno step ${next + 1}: ${SUNO_GUIDED_STEPS[next].name}`, "info");
          }}
          className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-bold text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Back
        </button>
        <button
          type="button"
          disabled={step >= lastIndex}
          onClick={() => {
            const next = Math.min(lastIndex, step + 1);
            if (next === step) return;
            setStep(next);
            setStatusWithTime(`Suno step ${next + 1}: ${SUNO_GUIDED_STEPS[next].name}`, "info");
          }}
          className="rounded-2xl bg-cyan-300 px-4 py-2 text-xs font-bold text-black hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {step === lastIndex - 1 ? "Show copy blocks" : "Next step"}
        </button>
        <button
          type="button"
          onClick={() => {
            setStep(0);
            setStatusWithTime("Suno guided path restarted at step 1", "info");
          }}
          className="rounded-2xl border border-white/15 bg-black/30 px-4 py-2 text-xs font-bold text-white/80 hover:bg-white/10"
        >
          Start over
        </button>
        <button
          type="button"
          onClick={() => {
            setStep(lastIndex);
            setStatusWithTime("Jumped to final Suno copy");
          }}
          className="rounded-2xl border border-fuchsia-400/35 bg-fuchsia-500/15 px-4 py-2 text-xs font-bold text-fuchsia-100 hover:bg-fuchsia-500/25"
        >
          Skip to final copy
        </button>
      </div>

      {step === lastIndex ? (
        <div className="mt-5 space-y-4 border-t border-white/10 pt-4">
          <div>
            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
              <div className="text-xs font-bold text-cyan-200">1) Suno “Style of Music” — paste this</div>
              <div className="text-[10px] font-mono text-white/45">
                {finalStyle.length} / {SUNO_STYLE_CHAR_CAP} chars
              </div>
            </div>
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-2xl border border-cyan-400/25 bg-black/50 p-3 text-[11px] leading-relaxed text-cyan-50/95">
              {finalStyle}
            </pre>
            <button
              type="button"
              onClick={() => copyToClipboard(finalStyle, "Suno style (1000-safe) copied")}
              className="mt-2 w-full rounded-2xl bg-cyan-300 py-2 text-sm font-bold text-black hover:bg-cyan-200"
            >
              Copy final Style (Suno box)
            </button>
          </div>

          <div>
            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
              <div className="text-xs font-bold text-fuchsia-200">2) Suno “Lyrics” — paste this</div>
              <div
                className={
                  "text-[10px] font-mono " +
                  (finalLyrics.length > SUNO_LYRICS_CHAR_TYPICAL_MAX
                    ? "text-red-300"
                    : finalLyrics.length > SUNO_LYRICS_CHAR_WARN
                      ? "text-amber-200"
                      : "text-white/45")
                }
              >
                {finalLyrics.length} / {SUNO_LYRICS_CHAR_TYPICAL_MAX} (priority-trimmed)
              </div>
            </div>
            <p className="mb-1 text-[10px] text-white/40">
              Theme, language, and section tags stay first; long lyric bodies trim from the end.
            </p>
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-2xl border border-fuchsia-400/25 bg-black/50 p-3 text-[11px] leading-relaxed text-fuchsia-50/95">
              {finalLyrics}
            </pre>
            <button
              type="button"
              onClick={() => copyToClipboard(finalLyrics, "Suno lyrics field copied")}
              className="mt-2 w-full rounded-2xl border border-fuchsia-400/50 bg-fuchsia-500/20 py-2 text-sm font-bold text-fuchsia-50 hover:bg-fuchsia-500/30"
            >
              Copy final Lyrics field
            </button>
          </div>

          <p className="text-[10px] leading-relaxed text-white/45">{SUNO_LIMITS_NOTE}</p>
        </div>
      ) : null}
    </Panel>
  );
});
