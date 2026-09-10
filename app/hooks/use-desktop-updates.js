"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  checkForDesktopUpdates,
  getDesktopUpdateRuntime,
  installDesktopUpdate,
  subscribeToDesktopUpdateStatus,
} from "../lib/desktop-update-bridge";

import { reportCaughtError } from "../lib/fail-safe-runtime-capture";

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

export const STUDIO_UPDATE_CHECK_STALL_MS = 20_000;

export function isStuckStudioUpdateProgress(status, pct) {
  return pct === 85 && /checking studio app update/i.test(String(status || ""));
}

/** Shared across hook instances (status bar + header controls). */
let silentUpdateStarted = false;

/** @internal vitest only */
export function resetDesktopUpdateSilentFlagForTests() {
  silentUpdateStarted = false;
}

export function useDesktopUpdates() {
  // Always start as null so SSR HTML matches the first client paint (window.__TAURI__
  // exists in Studio but not during Next SSR). Detect the host after mount.
  const [runtime, setRuntime] = useState(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [progressPct, setProgressPct] = useState(null);
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

  const checkUpdates = useCallback(
    async ({ automatic = false } = {}) => {
      if (!runtime) return null;
      clearHideTimer();
      setBusy(true);
      if (!automatic) {
        setProgressPct(5);
        setStatus("Checking for updates…");
      }
      try {
        const result = await checkForDesktopUpdates();
        if (!result?.ok) {
          if (!automatic) showErrorBriefly(result?.error || "Update check failed");
          else hideStatus();
          return result;
        }
        if (result.available) {
          setStatus(
            result.version
              ? `Studio update available: v${result.version}`
              : "Studio update available",
          );
          setProgressPct(null);
          setBusy(false);
        } else if (!automatic) {
          setStatus("Studio is current. Update all still refreshes addons, plugins, tools, and archives.");
          setBusy(false);
          setProgressPct(null);
        } else {
          hideStatus();
        }
        return result;
      } catch (error) {
        if (!automatic) {
          showErrorBriefly(error instanceof Error ? error.message : "Update check failed");
        } else {
          hideStatus();
        }
        return null;
      }
    },
    [clearHideTimer, hideStatus, runtime, showErrorBriefly],
  );

  const updateAll = useCallback(async () => {
    if (!runtime) return null;
    clearHideTimer();
    setBusy(true);
    setProgressPct(8);
    setStatus("Updating addons, plugins, tools, archives, and Studio…");
    try {
      const result = await installDesktopUpdate();
      if (!result?.ok) {
        showErrorBriefly(result?.error || "Update installation failed");
        return result;
      }
      setStatus(
        result.summary ||
          (result.available
            ? "Studio update installed."
            : "Addons, plugins, tools, and archives are current."),
      );
      setProgressPct(100);
      setBusy(false);
      hideTimerRef.current = setTimeout(() => {
        hideStatus();
      }, 2200);
      return result;
    } catch (error) {
      showErrorBriefly(error instanceof Error ? error.message : "Update installation failed");
      return null;
    }
  }, [clearHideTimer, hideStatus, runtime, showErrorBriefly]);

  const runSilentUpdate = useCallback(async () => {
    if (!runtime || silentUpdateStarted) return;
    silentUpdateStarted = true;
    try {
      const check = await checkForDesktopUpdates();
      if (!check?.ok || !check.available) return;
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
      // Status bar and header each own hook state. Finish events must dismiss the bar
      // here — only the instance that called updateAll schedules hideStatus otherwise.
      const finished =
        payload.pct === 100 || /update check finished|timed out/i.test(message);
      if (finished) {
        setBusy(false);
        clearHideTimer();
        hideTimerRef.current = setTimeout(() => {
          hideStatus();
        }, 2200);
      } else if (message || payload.phase) {
        clearHideTimer();
        setBusy(true);
      }
    });
    const timer = setTimeout(() => void runSilentUpdate(), 1500);
    return () => {
      clearTimeout(timer);
      unsubscribe();
      clearHideTimer();
    };
  }, [clearHideTimer, hideStatus, runSilentUpdate, runtime]);

  useEffect(() => {
    if (!busy || !isStuckStudioUpdateProgress(status, progressPct)) return undefined;
    const timer = setTimeout(() => {
      reportCaughtError(
        "desktop.update.studio-check",
        new Error(status || "Studio update check stalled at 85%"),
      );
      showErrorBriefly("Studio update check timed out — GitHub did not respond");
    }, STUDIO_UPDATE_CHECK_STALL_MS);
    return () => clearTimeout(timer);
  }, [busy, progressPct, showErrorBriefly, status]);

  return {
    available: Boolean(runtime),
    visible: Boolean(runtime) && (busy || Boolean(status)),
    status,
    busy,
    progressPct,
    installReady: runtime === "tauri",
    installLabel: "Update all",
    checkUpdates,
    updateAll,
  };
}
