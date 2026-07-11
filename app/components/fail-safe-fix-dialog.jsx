"use client";

import { memo } from "react";

const STEPS = [
  { id: "detect", label: "Bug detected" },
  { id: "fix", label: "Auto-fixing" },
  { id: "verify", label: "Running check:ci" },
  { id: "push", label: "Commit & push" },
  { id: "done", label: "Finished" },
];

/**
 * @param {{ open: boolean, phase: string, statusLine: string, stepIndex: number, issues: object[], result: object|null, fixPushAvailable: boolean, onStartFix: (mode: string) => void, onFinished: () => void, onStartFixLocal?: () => void }} props
 */
export const FailSafeFixDialog = memo(function FailSafeFixDialog({
  open,
  phase,
  statusLine,
  stepIndex,
  issues,
  result,
  fixPushAvailable,
  canCloud,
  onStartFix,
  onFinished,
}) {
  if (!open) return null;

  const running = phase === "running";
  const done = phase === "done";
  const failed = phase === "error";
  const waiting = phase === "bug-found";
  const finishedEnabled = !running && (done || failed || waiting);

  return (
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fail-safe-fix-dialog-title"
      data-testid="fail-safe-fix-dialog"
    >
      <div className="max-h-[min(90vh,32rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-amber-400/35 bg-[#12151a] p-5 shadow-2xl">
        <div className="mb-4 flex items-start gap-3">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg ${
              failed
                ? "bg-red-500/20 text-red-200"
                : done
                  ? "bg-emerald-500/20 text-emerald-200"
                  : "bg-amber-500/20 text-amber-200"
            }`}
            aria-hidden
          >
            {failed ? "!" : done ? "✓" : "⚠"}
          </span>
          <div>
            <h2 id="fail-safe-fix-dialog-title" className="text-base font-bold text-white">
              {failed ? "Fix failed" : done ? "Fix complete" : "Bug found"}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-white/60">{statusLine}</p>
          </div>
        </div>

        {issues?.length ? (
          <ul className="mb-4 space-y-2 rounded-xl border border-white/10 bg-black/30 p-3 text-[11px] text-white/75">
            {issues.map((issue) => (
              <li key={issue.id}>
                <span className="font-bold text-amber-100/95">{issue.title}</span>
                {issue.detail ? <p className="mt-0.5 text-white/50">{issue.detail}</p> : null}
              </li>
            ))}
          </ul>
        ) : null}

        <ol className="mb-4 space-y-2" aria-label="Fix progress">
          {STEPS.map((step, index) => {
            const active = index === stepIndex;
            const complete = index < stepIndex || (done && index <= stepIndex);
            return (
              <li
                key={step.id}
                className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] ${
                  active
                    ? "border border-violet-400/40 bg-violet-500/15 text-violet-100"
                    : complete
                      ? "text-emerald-200/90"
                      : "text-white/35"
                }`}
              >
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    active
                      ? "animate-pulse bg-violet-400"
                      : complete
                        ? "bg-emerald-400"
                        : "bg-white/20"
                  }`}
                />
                {step.label}
                {active && running ? (
                  <span className="ml-auto font-mono text-[10px] text-white/45">live…</span>
                ) : null}
              </li>
            );
          })}
        </ol>

        {result?.pr_url ? (
          <p className="mb-3 truncate text-[10px] text-emerald-200/90">PR: {result.pr_url}</p>
        ) : null}
        {result?.workflow_url ? (
          <p className="mb-3 truncate text-[10px] text-cyan-200/90">{result.workflow_url}</p>
        ) : null}

        {waiting && fixPushAvailable ? (
          <div className="mb-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-xl border border-violet-400/40 bg-violet-500/20 px-3 py-2 text-xs font-bold text-violet-100 hover:bg-violet-500/30"
              onClick={() => onStartFix("local")}
            >
              Start fix &amp; push
            </button>
            {canCloud ? (
              <button
                type="button"
                className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white/80 hover:bg-black/55"
                onClick={() => onStartFix("cloud")}
              >
                Cloud fix
              </button>
            ) : null}
          </div>
        ) : null}

        {running ? (
          <p className="mb-3 text-center text-[11px] text-white/45">
            Please wait — fail-safe bot is working…
          </p>
        ) : null}

        <button
          type="button"
          disabled={!finishedEnabled}
          onClick={onFinished}
          className={`w-full rounded-xl px-4 py-2.5 text-sm font-bold transition ${
            finishedEnabled
              ? done
                ? "border border-emerald-400/40 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30"
                : "border border-white/20 bg-white/10 text-white hover:bg-white/15"
              : "cursor-not-allowed border border-white/10 bg-white/5 text-white/30"
          }`}
          data-testid="fail-safe-fix-dialog-finished"
        >
          {running ? "Working…" : done ? "Finished" : failed ? "Close" : "Dismiss"}
        </button>
      </div>
    </div>
  );
});

export { STEPS as FAIL_SAFE_FIX_STEPS };
