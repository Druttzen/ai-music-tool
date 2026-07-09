"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  evaluateGuidedStepCoach,
  guidedCoachFingerprint,
} from "../lib/suno-guided-step-focus";
import { getStepCount } from "../lib/suno-guided-workflow";
import { useGuidedFocus } from "../context/guided-focus-context";
import {
  useProjectWorkspaceActions,
  useProjectWorkspaceAnalyzerState,
  useProjectWorkspaceProjectState,
  useProjectWorkspacePromptState,
} from "../context/project-workspace-context";

const COACH_DEBOUNCE_MS = 1800;

/**
 * AI step coach — nudges user to proceed or apply one-click improvements.
 */
export const GuidedStepCoachBanner = memo(function GuidedStepCoachBanner() {
  const { focused, setShowAll, showAll } = useGuidedFocus();
  const {
    guidedStep,
    promptEngine,
    selectedGenres,
    selectedRhythms,
    selectedSounds,
    tempo,
    vocal,
    instrumentalVocalFx,
    mood,
    idea,
    structure,
    rules,
    lyricTheme,
    lyricStyle,
    generatedLyrics,
  } = useProjectWorkspaceProjectState();
  const { audioAnalysis, imageAnalysis } = useProjectWorkspaceAnalyzerState();
  const { sunoWarnings, voiceStyleCompact, voiceStyleLine } = useProjectWorkspacePromptState();
  const {
    setGuidedStep,
    fixSunoWarnings,
    applyGenreAnchors,
    generateExampleLyrics,
    setStatusWithTime,
  } = useProjectWorkspaceActions();

  const [coach, setCoach] = useState(null);
  const dismissedRef = useRef(new Set());
  const timerRef = useRef(null);
  const lastStepRef = useRef(guidedStep);

  const snapshot = useMemo(
    () => ({
      guidedStep,
      selectedGenres,
      selectedRhythms,
      selectedSounds,
      tempo,
      vocal,
      instrumentalVocalFx,
      mood,
      idea,
      structure,
      rules,
      lyricTheme,
      lyricStyle,
      generatedLyrics,
      sunoWarnings,
      audioAnalysis,
      imageAnalysis,
      voiceStyleCompact,
      voiceStyleLine,
    }),
    [
      guidedStep,
      selectedGenres,
      selectedRhythms,
      selectedSounds,
      tempo,
      vocal,
      instrumentalVocalFx,
      mood,
      idea,
      structure,
      rules,
      lyricTheme,
      lyricStyle,
      generatedLyrics,
      sunoWarnings,
      audioAnalysis,
      imageAnalysis,
      voiceStyleCompact,
      voiceStyleLine,
    ],
  );

  const report = useMemo(() => evaluateGuidedStepCoach(snapshot), [snapshot]);

  useEffect(() => {
    if (lastStepRef.current !== guidedStep) {
      dismissedRef.current = new Set();
      lastStepRef.current = guidedStep;
      setCoach(null);
    }
  }, [guidedStep]);

  useEffect(() => {
    if (promptEngine !== "Suno-like") {
      setCoach(null);
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const fingerprint = guidedCoachFingerprint(report);
      if (dismissedRef.current.has(fingerprint)) return;

      const hasActionable =
        report.complete || report.improvements.length > 0 || report.missing.length > 0;
      if (!hasActionable) {
        setCoach(null);
        return;
      }

      setCoach({ report, fingerprint });
    }, COACH_DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [promptEngine, report]);

  const dismiss = useCallback(() => {
    if (coach?.fingerprint) dismissedRef.current.add(coach.fingerprint);
    setCoach(null);
  }, [coach?.fingerprint]);

  const proceedNext = useCallback(() => {
    const last = getStepCount() - 1;
    if (guidedStep >= last) {
      setStatusWithTime("You are on the final copy step", "info");
      dismiss();
      return;
    }
    setGuidedStep(guidedStep + 1);
    setStatusWithTime(`Moving to step ${guidedStep + 2}: ${report.nextStepName || "next"}`, "success");
    dismiss();
  }, [dismiss, guidedStep, report.nextStepName, setGuidedStep, setStatusWithTime]);

  const runImprovement = useCallback(
    (action) => {
      if (action === "fixSunoWarnings") fixSunoWarnings();
      else if (action === "applyGenreAnchors") applyGenreAnchors();
      else if (action === "generateExampleLyrics") generateExampleLyrics();
      else if (action === "showAnalyzers") {
        setShowAll(true);
        setStatusWithTime("Showing all tools — scroll to Drag & Drop Analyzers", "info");
      } else if (action === "focusVocalEmbed") {
        setShowAll(true);
        setStatusWithTime("Showing all tools — scroll to Vocal Embed Studio", "info");
      }
      dismiss();
    },
    [
      applyGenreAnchors,
      dismiss,
      fixSunoWarnings,
      generateExampleLyrics,
      setShowAll,
      setStatusWithTime,
    ],
  );

  if (!focused || !coach) return null;

  const { report: r } = coach;
  const onFinalStep = guidedStep >= getStepCount() - 1;

  return (
    <div
      role="dialog"
      aria-live="polite"
      data-testid="guided-step-coach"
      className="pointer-events-auto fixed left-1/2 top-20 z-[9999] w-[min(94vw,40rem)] -translate-x-1/2 rounded-2xl border border-violet-400/35 bg-violet-950/95 p-4 shadow-2xl ring-2 ring-violet-400/30 backdrop-blur-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-violet-200/70">
            Maestro step coach · Step {r.step + 1} — {r.stepName}
          </div>
          {r.complete ? (
            <p className="mt-1 text-sm font-semibold leading-snug text-white">
              {onFinalStep
                ? "This step looks ready. Copy Style + Lyrics into Suno when you are satisfied."
                : `Nice — "${r.stepName}" looks complete. Ready for ${r.nextStepName || "the next step"}?`}
            </p>
          ) : (
            <p className="mt-1 text-sm font-semibold leading-snug text-white">
              A few things still need attention on this step:
            </p>
          )}
        </div>
        <button
          type="button"
          aria-label="Dismiss coach"
          onClick={dismiss}
          className="shrink-0 rounded-lg px-2 py-1 text-sm font-bold text-white/50 hover:bg-white/10 hover:text-white"
        >
          ×
        </button>
      </div>

      {r.missing.length > 0 ? (
        <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-amber-100/90">
          {r.missing.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}

      {r.improvements.length > 0 ? (
        <div className="mt-3 space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-200/80">
            Suggested improvements
          </div>
          {r.improvements.map((imp) => (
            <div
              key={imp.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2"
            >
              <div className="min-w-0">
                <div className="text-xs font-bold text-cyan-100">{imp.title}</div>
                <div className="text-[11px] text-white/55">{imp.description}</div>
              </div>
              <button
                type="button"
                onClick={() => runImprovement(imp.action)}
                className="shrink-0 rounded-xl bg-cyan-300 px-3 py-1.5 text-xs font-bold text-black hover:bg-cyan-200"
              >
                Apply
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {r.complete && !onFinalStep ? (
          <button
            type="button"
            onClick={proceedNext}
            className="rounded-xl bg-emerald-300 px-4 py-2 text-sm font-bold text-black hover:bg-emerald-200"
          >
            Proceed to next step
          </button>
        ) : null}
        {showAll ? (
          <button
            type="button"
            onClick={() => setShowAll(false)}
            className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/15"
          >
            Focus current step
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/15"
          >
            Show all tools
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          className="rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-white/60 hover:text-white"
        >
          Not now
        </button>
      </div>
    </div>
  );
});
