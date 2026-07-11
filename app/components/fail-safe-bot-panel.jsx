"use client";

import { memo, useState } from "react";
import {
  formatScanAge,
  getActionableIssues,
  overallSeverity,
} from "../lib/fail-safe-bot";
import { useFailSafeBot } from "../hooks/use-fail-safe-bot";
import {
  useProjectWorkspaceActions,
  useProjectWorkspaceAnalyzerState,
} from "../context/project-workspace-context";

const SEVERITY_STYLES = {
  ok: "border-emerald-400/35 bg-emerald-500/10 text-emerald-50",
  warn: "border-amber-400/40 bg-amber-500/10 text-amber-50",
  fail: "border-red-400/45 bg-red-500/15 text-red-100",
  checking: "border-cyan-400/30 bg-cyan-500/10 text-cyan-100",
};

export const FailSafeBotPanel = memo(function FailSafeBotPanel() {
  const { sidecarAiStatus, sidecarGenerateAvailable } = useProjectWorkspaceAnalyzerState();
  const { setStatusWithTime } = useProjectWorkspaceActions();
  const { report, busy, probe, copyFixCommands, mounted } = useFailSafeBot({
    sidecarAiStatus,
    sidecarGenerateAvailable,
  });
  const [expanded, setExpanded] = useState(false);

  const checking = !mounted || busy || sidecarAiStatus === "checking";
  const actionable = getActionableIssues(report?.issues);
  const overall =
    mounted && report
      ? actionable.length
        ? overallSeverity(actionable)
        : report.overall
      : "ok";
  const topIssue = actionable[0] || report?.issues?.[0];
  const displayIssues = expanded
    ? report?.issues || []
    : actionable.length
      ? actionable
      : report?.issues?.slice(0, 1) || [];
  const fixCount = mounted
    ? displayIssues.flatMap((i) => i.fixCommands || []).filter(Boolean).length
    : 0;
  const scanAge = mounted && report?.at ? formatScanAge(report.at) : null;

  const statusClass = checking
    ? SEVERITY_STYLES.checking
    : SEVERITY_STYLES[overall] || SEVERITY_STYLES.ok;

  const statusLabel = checking
    ? "checking…"
    : topIssue
      ? topIssue.title
      : "runtime health OK";

  const handleCopy = async () => {
    const ok = await copyFixCommands();
    setStatusWithTime(
      ok ? "Fail-safe fix commands copied to clipboard" : "Nothing to copy",
      ok ? "success" : "info",
    );
  };

  return (
    <div
      className={`rounded-2xl border px-3 py-2 font-mono text-[11px] leading-snug ${statusClass}`}
      data-testid="fail-safe-bot-panel"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          <span className="shrink-0 rounded-full border border-white/15 bg-black/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
            Fail-safe bot
          </span>
          <span className="truncate text-white/85">{statusLabel}</span>
          {scanAge ? (
            <span className="shrink-0 text-[10px] text-white/40">· {scanAge}</span>
          ) : null}
        </button>
        <div className="flex shrink-0 items-center gap-1.5">
          {fixCount > 0 ? (
            <button
              type="button"
              className="rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-[10px] text-white/80 hover:bg-black/45"
              onClick={() => void handleCopy()}
            >
              Copy fixes
            </button>
          ) : null}
          <button
            type="button"
            className="rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-[10px] text-white/80 hover:bg-black/45"
            onClick={() => void probe()}
            disabled={checking}
          >
            Rescan
          </button>
        </div>
      </div>

      {expanded && mounted && displayIssues.length ? (
        <ul className="mt-2 space-y-2 border-t border-white/10 pt-2 text-[10px] text-white/75">
          {displayIssues.map((issue) => (
            <li key={issue.id}>
              <span className="font-bold text-white/90">[{issue.severity}] {issue.title}</span>
              {issue.detail ? <p className="mt-0.5 text-white/60">{issue.detail}</p> : null}
              {issue.fixCommands?.length ? (
                <ul className="mt-1 space-y-0.5 text-cyan-100/90">
                  {issue.fixCommands.map((cmd) => (
                    <li key={cmd}>→ {cmd}</li>
                  ))}
                </ul>
              ) : null}
              {issue.safeFallback ? (
                <p className="mt-1 text-white/50">safe: {issue.safeFallback}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-1.5 text-[10px] text-white/45">
        CI/build: <span className="text-white/65">npm run fail-safe:run</span>
        {" · "}
        setup: <span className="text-white/65">npm run bots:install</span>
      </p>
    </div>
  );
});
