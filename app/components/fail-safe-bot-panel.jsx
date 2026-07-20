"use client";

import { memo, useEffect, useState } from "react";
import {
  formatScanAge,
  getActionableIssues,
  overallSeverity,
} from "../lib/fail-safe-bot";
import { useFailSafeBot } from "../hooks/use-fail-safe-bot";
import { useFailSafeFixPush } from "../hooks/use-fail-safe-fix-push";
import { useFailSafeFixSession } from "../hooks/use-fail-safe-fix-session";
import { FailSafeFixDialog } from "./fail-safe-fix-dialog";
import {
  getMaintainerGithubToken,
  setMaintainerGithubToken,
} from "../lib/maintainer-settings";
import {
  buildGitHubNewIssueUrl,
  getRuntimeReportQueue,
  hasRuntimeTelemetryConsent,
  isRuntimeReportingEnabled,
  markRuntimeReportDelivered,
  setRuntimeReportingEnabled,
  setRuntimeTelemetryConsent,
} from "../lib/fail-safe-runtime-reporter";
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
  const { report, busy, probe, copyFixCommands, mounted, refreshRuntimeListeners } = useFailSafeBot({
    sidecarAiStatus,
    sidecarGenerateAvailable,
  });
  const {
    available: fixPushAvailable,
    maintainerMode,
    busy: fixPushBusy,
    canCloud,
    fixAndPush,
  } = useFailSafeFixPush();
  const [expanded, setExpanded] = useState(false);
  const [ghTokenDraft, setGhTokenDraft] = useState("");
  const [runtimeReportOn, setRuntimeReportOn] = useState(false);
  const [runtimeConsentOn, setRuntimeConsentOn] = useState(false);
  const [queueLen, setQueueLen] = useState(0);

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

  const fixSession = useFailSafeFixSession({
    actionableIssues: mounted && !checking ? actionable : [],
    fixAndPush,
    fixPushAvailable,
    autoStartFix: fixPushAvailable,
    autoNotify: process.env.NEXT_PUBLIC_E2E !== "1",
  });

  useEffect(() => {
    if (!mounted) return;
    setRuntimeReportOn(isRuntimeReportingEnabled());
    setRuntimeConsentOn(hasRuntimeTelemetryConsent());
    setQueueLen(getRuntimeReportQueue().length);
  }, [mounted, expanded]);

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

  const handleFixPush = (mode) => {
    fixSession.openBugDialog(actionable, { autoFix: true, mode });
  };

  const handleFinished = () => {
    if (fixSession.phase === "done") {
      setStatusWithTime(fixSession.statusLine || "Fail-safe fix complete", "success");
      void probe();
    } else if (fixSession.phase === "error") {
      setStatusWithTime(fixSession.statusLine || "Fix & push failed", "error");
    }
    fixSession.closeDialog();
  };

  const saveGhToken = () => {
    setMaintainerGithubToken(ghTokenDraft);
    setStatusWithTime(
      ghTokenDraft.trim() ? "GitHub token saved (local only)" : "GitHub token cleared",
      "info",
    );
  };

  const syncRuntimeFlags = () => {
    setRuntimeReportOn(isRuntimeReportingEnabled());
    setRuntimeConsentOn(hasRuntimeTelemetryConsent());
    setQueueLen(getRuntimeReportQueue().length);
  };

  const handleToggleRuntimeReport = (on) => {
    setRuntimeReportingEnabled(on);
    setRuntimeReportOn(on);
    refreshRuntimeListeners?.();
    syncRuntimeFlags();
  };

  const handleToggleRuntimeConsent = (on) => {
    setRuntimeTelemetryConsent(on);
    setRuntimeConsentOn(on);
    refreshRuntimeListeners?.();
    syncRuntimeFlags();
  };

  const handleFlushRuntimeReport = () => {
    const [top] = getRuntimeReportQueue();
    if (!top) {
      setStatusWithTime("No queued Runtime reports", "info");
      return;
    }
    const url = buildGitHubNewIssueUrl(top);
    window.open(url, "_blank", "noopener,noreferrer");
    markRuntimeReportDelivered(top.fingerprint, { mode: "github-new-issue-url", url });
    syncRuntimeFlags();
    setStatusWithTime("Opened GitHub new-issue form for Runtime report", "success");
  };

  return (
    <>
      <FailSafeFixDialog
        open={fixSession.open}
        phase={fixSession.phase}
        statusLine={fixSession.statusLine}
        stepIndex={fixSession.stepIndex}
        issues={fixSession.sessionIssues}
        result={fixSession.result}
        fixPushAvailable={fixPushAvailable}
        canCloud={canCloud}
        onStartFix={(mode) => void fixSession.startFix(mode)}
        onFinished={handleFinished}
      />

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
            {actionable.length > 0 ? (
              <button
                type="button"
                className="rounded-lg border border-amber-400/35 bg-amber-500/15 px-2 py-1 text-[10px] font-bold text-amber-100 hover:bg-amber-500/25"
                onClick={() => fixSession.openBugDialog(actionable, { autoFix: false })}
              >
                View bug
              </button>
            ) : null}
            {fixPushAvailable ? (
              <button
                type="button"
                className="rounded-lg border border-violet-400/35 bg-violet-500/15 px-2 py-1 text-[10px] font-bold text-violet-100 hover:bg-violet-500/25"
                disabled={fixPushBusy || checking || fixSession.phase === "running"}
                onClick={() => handleFixPush("local")}
                title="Run fail-safe fix, commit, push — users get auto-update after merge + release"
              >
                {fixPushBusy || fixSession.phase === "running" ? "Fixing…" : "Fix & push"}
              </button>
            ) : null}
            {canCloud && !maintainerMode ? (
              <button
                type="button"
                className="rounded-lg border border-violet-400/35 bg-violet-500/15 px-2 py-1 text-[10px] text-violet-100 hover:bg-violet-500/25"
                disabled={fixPushBusy || fixSession.phase === "running"}
                onClick={() => handleFixPush("cloud")}
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
            <p className="font-bold text-white/70">Fail-Safe Runtime (opt-in)</p>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={runtimeReportOn}
                onChange={(e) => handleToggleRuntimeReport(e.target.checked)}
              />
              Enable background error queue
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={runtimeConsentOn}
                onChange={(e) => handleToggleRuntimeConsent(e.target.checked)}
              />
              Telemetry consent (required to queue)
            </label>
            <p className="text-white/45">
              Queued reports: {queueLen}
              {runtimeReportOn && runtimeConsentOn ? " · listeners on" : " · listeners off"}
            </p>
            <button
              type="button"
              className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-2 py-1 text-[10px] text-cyan-100 disabled:opacity-40"
              disabled={queueLen < 1}
              onClick={handleFlushRuntimeReport}
              title="Opens GitHub new-issue form with the top queued report (no auto-push)"
            >
              Send top report to GitHub…
            </button>
            <p className="text-white/40">
              Maintainer CLI:{" "}
              <span className="text-white/65">npm run fail-safe-ops -- deliver-runtime report.json</span>
            </p>
            <label className="block pt-1">
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

        <p className="mt-1.5 text-[10px] text-white/45">
          Ops: <span className="text-white/65">npm run fail-safe-ops -- diagnose -</span>
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
    </>
  );
});
