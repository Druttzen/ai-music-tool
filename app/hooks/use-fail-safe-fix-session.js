"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Fail-safe fix dialog session — bug-found popup, live status, finished gate.
 * @param {{ actionableIssues: object[], fixAndPush: Function, fixPushAvailable: boolean, autoStartFix: boolean }} params
 */
export function useFailSafeFixSession({
  actionableIssues = [],
  fixAndPush,
  fixPushAvailable = false,
  autoStartFix = true,
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
      setStepIndex(1);
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
          setStatusLine(res.message || "Fix pushed — merge & release for auto-update.");
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
      if (autoFix && fixPushAvailable) {
        void startFix(mode);
      }
    },
    [actionableIssues, fixPushAvailable, startFix],
  );

  useEffect(() => {
    if (!actionableIssues.length) return undefined;
    const fp = actionableIssues.map((i) => i.id).join("|");
    if (notifiedRef.current === fp || phase === "running") return undefined;
    notifiedRef.current = fp;
    const timer = setTimeout(() => {
      openBugDialog(actionableIssues, {
        autoFix: autoStartFix && fixPushAvailable,
        mode: "local",
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [actionableIssues, autoStartFix, fixPushAvailable, openBugDialog, phase]);

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
    closeDialog,
  };
}
