"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { remediateRuntimeIssues } from "../lib/fail-safe-local-remediate";

/**
 * Fail-safe fix dialog session — bug-found popup, local repair, optional maintainer push.
 * @param {{
 *   actionableIssues: object[],
 *   fixAndPush: Function,
 *   fixPushAvailable: boolean,
 *   autoStartFix: boolean,
 *   autoStartLocal?: boolean,
 *   onAfterLocalFix?: Function,
 * }} params
 */
export function useFailSafeFixSession({
  actionableIssues = [],
  fixAndPush,
  fixPushAvailable = false,
    autoStartFix: _autoStartFix = true,
  autoStartLocal = true,
  autoNotify = true,
  includeWarn = false,
  onAfterLocalFix,
}) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState("idle");
  const [statusLine, setStatusLine] = useState("");
  const [stepIndex, setStepIndex] = useState(0);
  const [result, setResult] = useState(null);
  const [sessionIssues, setSessionIssues] = useState([]);
  const notifiedRef = useRef("");
  const tickRef = useRef(null);

  const clearTick = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const startFix = useCallback(
    async (mode = "local") => {
      clearTick();
      setPhase("running");
      setStepIndex(3);
      setStatusLine(
        mode === "cloud"
          ? "Dispatching cloud fix workflow…"
          : "Running fail-safe auto-fix (check:ci)…",
      );
      setResult(null);

      tickRef.current = setInterval(() => {
        setStepIndex((i) => (i < 3 ? i + 1 : i));
      }, 3500);

      try {
        const res = await fixAndPush({ mode });
        clearTick();
        setStepIndex(4);
        setResult(res);
        if (res?.ok) {
          setPhase("done");
          setStatusLine(res.message || "Fix pushed — merge & publish studio-v* for users to install.");
        } else {
          setPhase("error");
          setStatusLine(res?.message || "Fix & push did not complete.");
        }
        return res;
      } catch (err) {
        clearTick();
        setStepIndex(4);
        setPhase("error");
        const msg = err instanceof Error ? err.message : "Fix & push failed";
        setStatusLine(msg);
        throw err;
      }
    },
    [clearTick, fixAndPush],
  );

  const startLocalRepair = useCallback(
    async (issues) => {
      const list = issues?.length ? issues : sessionIssues;
      clearTick();
      setPhase("running");
      setStepIndex(1);
      setStatusLine("Applying local repairs (no git push)…");
      setResult(null);

      tickRef.current = setInterval(() => {
        setStepIndex((i) => (i < 2 ? i + 1 : i));
      }, 2500);

      try {
        const res = await remediateRuntimeIssues(list);
        if (typeof onAfterLocalFix === "function") {
          await onAfterLocalFix();
        }
        clearTick();
        setStepIndex(res.ok ? 4 : 2);
        setResult(res);
        if (res.ok) {
          setPhase("done");
          setStatusLine(res.message || "Local repair complete.");
        } else {
          setPhase("error");
          setStatusLine(res.message || "Local repair did not finish.");
        }
        return res;
      } catch (err) {
        clearTick();
        setStepIndex(4);
        setPhase("error");
        const msg = err instanceof Error ? err.message : "Local repair failed";
        setStatusLine(msg);
        throw err;
      }
    },
    [clearTick, onAfterLocalFix, sessionIssues],
  );

  const startLocalThenMaybePush = useCallback(
    async (_mode = "local", issues) => startLocalRepair(issues?.length ? issues : sessionIssues),
    [sessionIssues, startLocalRepair],
  );

  const openBugDialog = useCallback(
    (issues, { autoFix = false, mode = "local" } = {}) => {
      const list = issues?.length ? issues : actionableIssues;
      if (!list.length) return;
      setSessionIssues(list);
      setOpen(true);
      setPhase("bug-found");
      setStepIndex(0);
      setResult(null);
      setStatusLine(
        `${list.length} issue${list.length === 1 ? "" : "s"} detected — review below.`,
      );
      if (autoFix) {
        void startLocalThenMaybePush(mode, list);
      }
    },
    [actionableIssues, startLocalThenMaybePush],
  );

  useEffect(() => {
    if (!autoNotify) return undefined;
    const critical = includeWarn
      ? actionableIssues.filter((i) => i.severity === "fail" || i.severity === "warn")
      : actionableIssues.filter((i) => i.severity === "fail");
    if (!critical.length) return undefined;
    const fp = critical.map((i) => i.id).join("|");
    if (notifiedRef.current === fp || phase === "running") return undefined;
    notifiedRef.current = fp;
    const timer = setTimeout(() => {
      openBugDialog(critical, {
        autoFix: autoStartLocal,
        mode: "local",
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [
    actionableIssues,
    autoNotify,
    autoStartLocal,
    includeWarn,
    openBugDialog,
    phase,
  ]);

  useEffect(() => () => clearTick(), [clearTick]);

  const closeDialog = useCallback(() => {
    if (phase === "running") return;
    setOpen(false);
    setPhase("idle");
    setStepIndex(0);
    setResult(null);
  }, [phase]);

  return {
    open,
    phase,
    statusLine,
    stepIndex,
    result,
    sessionIssues,
    openBugDialog,
    startFix,
    startLocalRepair,
    startLocalThenMaybePush,
    closeDialog,
  };
}
