"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildRuntimeHealthReport,
  FAIL_SAFE_STORAGE_KEY,
  formatReportSummary,
} from "../lib/fail-safe-bot";
import { safeLocalStorage } from "../lib/safe-local-storage";
import { fetchSidecarHealth } from "../lib/sidecar-bridge";

/**
 * In-app fail-safe bot — monitors runtime health and surfaces safe fix playbooks.
 * @param {{ sidecarAiStatus?: string, sidecarGenerateAvailable?: boolean }} params
 */
export function useFailSafeBot({ sidecarAiStatus, sidecarGenerateAvailable } = {}) {
  const [report, setReport] = useState(() =>
    safeLocalStorage.getJSON(FAIL_SAFE_STORAGE_KEY, null),
  );
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
    } finally {
      setBusy(false);
    }
  }, [sidecarAiStatus, sidecarGenerateAvailable]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void probe();
    }, 0);
    return () => clearTimeout(timer);
  }, [probe]);

  const copyFixCommands = useCallback(async () => {
    if (!report?.issues?.length) return false;
    const cmds = report.issues.flatMap((i) => i.fixCommands || []).filter(Boolean);
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

  return { report, busy, probe, copyFixCommands, summary };
}
