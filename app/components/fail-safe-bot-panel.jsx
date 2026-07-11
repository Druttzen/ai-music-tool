"use client";

import { memo, useState } from "react";
import {
  formatScanAge,
  getActionableIssues,
  overallSeverity,
} from "../lib/fail-safe-bot";
import { useFailSafeBot } from "../hooks/use-fail-safe-bot";
import { useFailSafeFixPush } from "../hooks/use-fail-safe-fix-push";
import {
  getMaintainerGithubToken,
  setMaintainerGithubToken,
} from "../lib/maintainer-settings";
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
  const {
    available: fixPushAvailable,
    maintainerMode,
    busy: fixPushBusy,
    lastResult,
    canCloud,
    fixAndPush,
  } = useFailSafeFixPush();
  const [expanded, setExpanded] = useState(false);
  const [ghTokenDraft, setGhTokenDraft] = useState("");

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

  const handleFixPush = async (mode) => {
    try {
      const result = await fixAndPush({ mode });
      if (result?.ok) {
        setStatusWithTime(result.message || "Fix pushed — merge/release for auto-update", "success");
        void probe();
      } else {
        setStatusWithTime(result?.message || "Fix & push failed", "error");
      }
    } catch (err) {
      setStatusWithTime(err instanceof Error ? err.message : "Fix & push failed", "error");
    }
  };

  const saveGhToken = () => {
    setMaintainerGithubToken(ghTokenDraft);
    setStatusWithTime(
      ghTokenDraft.trim() ? "GitHub token saved (local only)" : "GitHub token cleared",
      "info",
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
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {fixPushAvailable ? (
            <button
              type="button"
              className="rounded-lg border border-violet-400/35 bg-violet-500/15 px-2 py-1 text-[10px] font-bold text-violet-100 hover:bg-violet-500/25"
              disabled={fixPushBusy || checking}
              onClick={() => void handleFixPush("local")}
              title="Run fail-safe fix, commit, push — users get auto-update after merge + release"
            >
              {fixPushBusy ? "Fixing…" : "Fix & push"}
            </button>
          ) : null}
          {canCloud && !maintainerMode ? (
            <button
              type="button"
              className="rounded-lg border border-violet-400/35 bg-violet-500/15 px-2 py-1 text-[10px] text-violet-100 hover:bg-violet-500/25"
              disabled={fixPushBusy}
              onClick={() => void handleFixPush("cloud")}
            >
              Cloud fix
            </button>
          ) : null}
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

      {expanded && !fixPushAvailable && !canCloud ? (
        <p className="mt-2 border-t border-white/10 pt-2 text-[10px] text-white/50">
          In-app fix &amp; push: run{" "}
          <span className="text-white/70">npm run sidecar:maintainer</span> from repo root, or save
          a GitHub PAT below for cloud fix.
        </p>
      ) : null}

      {expanded ? (
        <div className="mt-2 space-y-1.5 border-t border-white/10 pt-2 text-[10px] text-white/55">
          <label className="block">
            GitHub token (cloud fix, localStorage only)
            <input
              type="password"
              className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-white/85"
              placeholder={getMaintainerGithubToken() ? "•••• saved" : "ghp_… repo scope"}
              value={ghTokenDraft}
              onChange={(e) => setGhTokenDraft(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-[10px] text-white/80"
            onClick={saveGhToken}
          >
            Save token
          </button>
        </div>
      ) : null}

      {lastResult?.ok && lastResult.pr_url ? (
        <p className="mt-1.5 text-[10px] text-emerald-200/90">PR: {lastResult.pr_url}</p>
      ) : null}

      <p className="mt-1.5 text-[10px] text-white/45">
        CI: <span className="text-white/65">npm run fail-safe:run</span>
        {" · "}
        setup: <span className="text-white/65">npm run bots:install</span>
        {maintainerMode ? (
          <>
            {" · "}
            <span className="text-violet-200/90">maintainer</span>
          </>
        ) : null}
      </p>
    </div>
  );
});
