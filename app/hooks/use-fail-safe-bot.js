"use client";

import { runProcess } from "../lib/process-status";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  buildRuntimeHealthReport,
  FAIL_SAFE_STORAGE_KEY,
  formatReportSummary,
  getActionableIssues,
} from "../lib/fail-safe-bot";
import { maybeReportHealthIssue } from "../lib/fail-safe-runtime-reporter";
import {
  installRuntimeErrorListeners,
  uninstallRuntimeErrorListeners,
} from "../lib/fail-safe-runtime-listeners";
import { collectAppSubsystemSnapshot } from "../lib/fail-safe-app-probes";
import { subscribeLocalFaults } from "../lib/fail-safe-runtime-fault";
import {
  claimLaunchScan,
  LAUNCH_SCAN_WAIT_MS,
  shouldRunLaunchScan,
  shouldWakeForSidecarOffline,
} from "../lib/fail-safe-hibernate";
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
 * In-app fail-safe bot — one launch scan, then hibernate until a runtime error.
 * Defers localStorage + sidecar reads until after hydration to avoid SSR mismatch.
 * @param {{ sidecarAiStatus?: string, sidecarGenerateAvailable?: boolean }} params
 */
export function useFailSafeBot({ sidecarAiStatus, sidecarGenerateAvailable } = {}) {
  const mounted = useSyncExternalStore(subscribeNoop, getClientHydrated, getServerHydrated);
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [hibernating, setHibernating] = useState(false);
  const [lastProbeReason, setLastProbeReason] = useState(null);
  const scannedRef = useRef(false);
  const probeEpochRef = useRef(0);
  const previousSidecarRef = useRef(sidecarAiStatus);

  const probe = useCallback(async (reason = "manual") => {
    return runProcess("Auto Fail-Safe scan", async () => {
    const epoch = ++probeEpochRef.current;
    setHibernating(false);
    setLastProbeReason(reason);
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
        appSubsystems: collectAppSubsystemSnapshot(),
      });
      if (epoch !== probeEpochRef.current) return next;
      setReport(next);
      safeLocalStorage.setJSON(FAIL_SAFE_STORAGE_KEY, next);
      // Fail-Safe Runtime (Product B): local queue only when enable + consent (default OFF).
      for (const issue of getActionableIssues(next.issues)) {
        maybeReportHealthIssue(issue, { sidecarAiStatus });
      }
      return next;
    } finally {
      if (epoch === probeEpochRef.current) {
        setBusy(false);
        scannedRef.current = true;
        setHibernating(true);
      }
    }
    });
  }, [sidecarAiStatus, sidecarGenerateAvailable]);

  useEffect(() => {
    if (!mounted) return undefined;
    const delay = shouldRunLaunchScan({
      mounted: true,
      sidecarAiStatus,
      alreadyClaimed: false,
    })
      ? 0
      : LAUNCH_SCAN_WAIT_MS;
    const timer = setTimeout(() => {
      if (claimLaunchScan()) void probe("launch");
    }, delay);
    return () => clearTimeout(timer);
  }, [mounted, probe, sidecarAiStatus]);

  useEffect(() => {
    if (!mounted) return undefined;
    installRuntimeErrorListeners({
      appVersion: typeof APP_VERSION === "string" ? APP_VERSION : undefined,
      sidecarAiStatus,
    });
    return () => uninstallRuntimeErrorListeners();
  }, [mounted, sidecarAiStatus]);

  useEffect(() => {
    if (!mounted) return undefined;
    let timer = null;
    const unsub = subscribeLocalFaults(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        void probe("fault");
      }, 250);
    });
    return () => {
      clearTimeout(timer);
      unsub();
    };
  }, [mounted, probe]);

  useEffect(() => {
    const previous = previousSidecarRef.current;
    previousSidecarRef.current = sidecarAiStatus;
    const wake = shouldWakeForSidecarOffline({
      alreadyScanned: scannedRef.current,
      previousStatus: previous,
      sidecarAiStatus,
    });
    const recovered = scannedRef.current && previous !== "ready" && sidecarAiStatus === "ready";
    if (!wake && !recovered) {
      return undefined;
    }
    const timer = setTimeout(() => {
      void probe("sidecar");
    }, 0);
    return () => clearTimeout(timer);
  }, [probe, sidecarAiStatus]);

  const refreshRuntimeListeners = useCallback(() => {
    if (!mounted) return;
    installRuntimeErrorListeners({
      appVersion: typeof APP_VERSION === "string" ? APP_VERSION : undefined,
      sidecarAiStatus,
    });
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

  return {
    report,
    busy,
    probe,
    copyFixCommands,
    summary,
    mounted,
    refreshRuntimeListeners,
    hibernating,
    lastProbeReason,
  };
}
