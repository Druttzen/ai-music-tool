"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  checkForDesktopUpdates,
  getDesktopUpdateRuntime,
  installDesktopUpdate,
  subscribeToDesktopUpdateStatus,
} from "../lib/desktop-update-bridge";

const PHASE_PCT = {
  sidecar: 12,
  canvas: 28,
  archives: 42,
  plugins: 55,
  plugin: 65,
  studio: 85,
  "studio-download": 90,
  "studio-install": 99,
};

export function useDesktopUpdates() {
  // Always start as null so SSR HTML matches the first client paint (window.__TAURI__
  // exists in Studio but not during Next SSR). Detect the host after mount.
  const [runtime, setRuntime] = useState(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [progressPct, setProgressPct] = useState(null);
  const startedRef = useRef(false);
  const hideTimerRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setRuntime(getDesktopUpdateRuntime());
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const hideStatus = useCallback(() => {
    clearHideTimer();
    setBusy(false);
    setProgressPct(null);
    setStatus("");
  }, [clearHideTimer]);

  const showErrorBriefly = useCallback(
    (message) => {
      clearHideTimer();
      setBusy(false);
      setProgressPct(null);
      setStatus(message);
      hideTimerRef.current = setTimeout(() => {
        setStatus("");
        hideTimerRef.current = null;
      }, 2800);
    },
    [clearHideTimer],
  );

  const runSilentUpdate = useCallback(async () => {
    if (!runtime || startedRef.current) return;
    startedRef.current = true;
    try {
      const check = await checkForDesktopUpdates();
      if (!check?.ok) {
        // Stay silent on check failures (offline, etc.) — no popup, no bar.
        return;
      }
      if (!check.available) {
        return;
      }

      clearHideTimer();
      setBusy(true);
      setProgressPct(8);
      setStatus(
        check.version
          ? `Downloading Studio update v${check.version}…`
          : "Downloading Studio update…",
      );

      const result = await installDesktopUpdate();
      if (!result?.ok) {
        showErrorBriefly(result?.error || "Update failed");
        return;
      }
      hideStatus();
    } catch (error) {
      showErrorBriefly(error instanceof Error ? error.message : "Update failed");
    }
  }, [clearHideTimer, hideStatus, runtime, showErrorBriefly]);

  useEffect(() => {
    if (!runtime) return undefined;
    const unsubscribe = subscribeToDesktopUpdateStatus((payload) => {
      if (!payload) return;
      const message = typeof payload.message === "string" ? payload.message.trim() : "";
      if (message) setStatus(message);
      if (typeof payload.pct === "number" && Number.isFinite(payload.pct)) {
        setProgressPct(Math.max(0, Math.min(100, Math.round(payload.pct))));
      } else if (payload.phase && PHASE_PCT[payload.phase] != null) {
        setProgressPct(PHASE_PCT[payload.phase]);
      }
      if (message || payload.phase) setBusy(true);
    });
    const timer = setTimeout(() => void runSilentUpdate(), 1500);
    return () => {
      clearTimeout(timer);
      unsubscribe();
      clearHideTimer();
    };
  }, [clearHideTimer, runSilentUpdate, runtime]);

  return {
    available: Boolean(runtime),
    visible: Boolean(runtime) && (busy || Boolean(status)),
    status,
    busy,
    progressPct,
  };
}
