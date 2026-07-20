"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  buildRuntimeHealthReport,
  FAIL_SAFE_STORAGE_KEY,
  formatReportSummary,
  getActionableIssues,
} from "../lib/fail-safe-bot";
import { maybeReportHealthIssue, canQueueRuntimeReports } from "../lib/fail-safe-runtime-reporter";
import {
  installRuntimeErrorListeners,
  uninstallRuntimeErrorListeners,
} from "../lib/fail-safe-runtime-listeners";
import { safeLocalStorage } from "../lib/safe-local-storage";
import { fetchSidecarHealth } from "../lib/sidecar-bridge";
import { APP_VERSION } from "../lib/music-config";

function subscribeNoop() {
  return () => {};
}

function getClientHydrated() {
  return true;
}

function getServerHydrated() {
  return false;
}

/**
 * In-app fail-safe bot — monitors runtime health and surfaces safe fix playbooks.
 * Defers localStorage + sidecar reads until after hydration to avoid SSR mismatch.
 * @param {{ sidecarAiStatus?: string, sidecarGenerateAvailable?: boolean }} params
 */
export function useFailSafeBot({ sidecarAiStatus, sidecarGenerateAvailable } = {}) {
  const mounted = useSyncExternalStore(subscribeNoop, getClientHydrated, getServerHydrated);
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);

  const probe = useCallback(async () => {
    setBusy(true);
    try {
      let health = null;
      if (sidecarAiStatus === "ready") {
        try {
          health = await fetchSidecarHealth();
        } catch {
          health = null;
        }
      }
      const next = buildRuntimeHealthReport({
        sidecarAiStatus,
        sidecarHealth: health,
        sidecarGenerateAvailable,
      });
      setReport(next);
      safeLocalStorage.setJSON(FAIL_SAFE_STORAGE_KEY, next);
      // Fail-Safe Runtime (Product B): local queue only when enable + consent (default OFF).
      for (const issue of getActionableIssues(next.issues)) {
        maybeReportHealthIssue(issue, { sidecarAiStatus });
      }
    } finally {
      setBusy(false);
    }
  }, [sidecarAiStatus, sidecarGenerateAvailable]);

  useEffect(() => {
    if (!mounted) return undefined;
    const timer = setTimeout(() => {
      const cached = safeLocalStorage.getJSON(FAIL_SAFE_STORAGE_KEY, null);
      if (cached?.at) setReport(cached);
    }, 0);
    return () => clearTimeout(timer);
  }, [mounted]);

  useEffect(() => {
    if (!mounted || sidecarAiStatus === "checking") return undefined;
    const timer = setTimeout(() => {
      void probe();
    }, 0);
    return () => clearTimeout(timer);
  }, [mounted, probe, sidecarAiStatus]);

  useEffect(() => {
    if (!mounted) return undefined;
    if (canQueueRuntimeReports()) {
      installRuntimeErrorListeners({
        appVersion: typeof APP_VERSION === "string" ? APP_VERSION : undefined,
        sidecarAiStatus,
      });
    } else {
      uninstallRuntimeErrorListeners();
    }
    return () => uninstallRuntimeErrorListeners();
  }, [mounted, sidecarAiStatus]);

  const refreshRuntimeListeners = useCallback(() => {
    if (!mounted) return;
    if (canQueueRuntimeReports()) {
      installRuntimeErrorListeners({
        appVersion: typeof APP_VERSION === "string" ? APP_VERSION : undefined,
        sidecarAiStatus,
      });
    } else {
      uninstallRuntimeErrorListeners();
    }
  }, [mounted, sidecarAiStatus]);

  const copyFixCommands = useCallback(async () => {
    if (!report?.issues?.length) return false;
    const actionable = getActionableIssues(report.issues);
    const source = actionable.length ? actionable : report.issues;
    const cmds = source.flatMap((i) => i.fixCommands || []).filter(Boolean);
    if (!cmds.length) return false;
    const text = cmds.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }, [report]);

  const summary = useMemo(() => (report ? formatReportSummary(report) : ""), [report]);

  return { report, busy, probe, copyFixCommands, summary, mounted, refreshRuntimeListeners };
}
