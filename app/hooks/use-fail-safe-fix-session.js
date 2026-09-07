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
 *   autoConfirmOnSuccess?: boolean,
 *   onAfterLocalFix?: Function,
 *   onAutoConfirm?: Function,
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
  autoConfirmOnSuccess = true,
  onAfterLocalFix,
  onAutoConfirm,
}) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState("idle");
  const [statusLine, setStatusLine] = useState("");
  const [stepIndex, setStepIndex] = useState(0);
  const [result, setResult] = useState(null);
  const [sessionIssues, setSessionIssues] = useState([]);
  const notifiedRef = useRef("");
  const tickRef = useRef(null);
  const autoConfirmRef = useRef(null);

  const clearTick = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const clearAutoConfirm = useCallback(() => {
    if (autoConfirmRef.current) {
      clearTimeout(autoConfirmRef.current);
      autoConfirmRef.current = null;
    }
  }, []);

  const closeDialog = useCallback(() => {
    if (phase === "running") return;
    clearAutoConfirm();
    setOpen(false);
    setPhase("idle");
    setStepIndex(0);
    setResult(null);
  }, [clearAutoConfirm, phase]);

  const scheduleAutoConfirm = useCallback(
    (message) => {
      if (!autoConfirmOnSuccess) return;
      clearAutoConfirm();
      autoConfirmRef.current = setTimeout(() => {
        autoConfirmRef.current = null;
        if (typeof onAutoConfirm === "function") {
          onAutoConfirm(message || "Fail-safe repairs complete");
        }
        setOpen(false);
        setPhase("idle");
        setStepIndex(0);
        setResult(null);
        notifiedRef.current = "";
      }, 1200);
    },
    [autoConfirmOnSuccess, clearAutoConfirm, onAutoConfirm],
  );

  const startFix = useCallback(
    async (mode = "local") => {
      clearTick();
      clearAutoConfirm();
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
          const msg =
            res.message || "Fix pushed — merge & publish studio-v* for users to install.";
          setStatusLine(msg);
          scheduleAutoConfirm(msg);
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
    [clearAutoConfirm, clearTick, fixAndPush, scheduleAutoConfirm],
  );

  const startLocalRepair = useCallback(
    async (issues) => {
      const list = issues?.length ? issues : sessionIssues;
      clearTick();
      clearAutoConfirm();
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
          const msg = res.message || "Local repair complete.";
          setStatusLine(msg);
          scheduleAutoConfirm(msg);
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
    [clearAutoConfirm, clearTick, onAfterLocalFix, scheduleAutoConfirm, sessionIssues],
  );

  const startLocalThenMaybePush = useCallback(
    async (_mode = "local", issues) => startLocalRepair(issues?.length ? issues : sessionIssues),
    [sessionIssues, startLocalRepair],
  );

  const openBugDialog = useCallback(
    (issues, { autoFix = false, mode = "local" } = {}) => {
      const list = issues?.length ? issues : actionableIssues;
      if (!list.length) return;
      clearAutoConfirm();
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
    [actionableIssues, clearAutoConfirm, startLocalThenMaybePush],
  );

  useEffect(() => {
    if (!autoNotify) return undefined;
    const critical = includeWarn
      ? actionableIssues.filter((i) => i.severity === "fail" || i.severity === "warn")
      : actionableIssues.filter((i) => i.severity === "fail");
    if (!critical.length) {
      // Issues cleared while dialog open — auto-confirm success.
      if (open && phase !== "running" && phase !== "idle") {
        scheduleAutoConfirm("All detected issues are resolved.");
      }
      return undefined;
    }
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
    open,
    openBugDialog,
    phase,
    scheduleAutoConfirm,
  ]);

  useEffect(
    () => () => {
      clearTick();
      clearAutoConfirm();
    },
    [clearAutoConfirm, clearTick],
  );

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
