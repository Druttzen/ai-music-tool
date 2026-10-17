"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  checkForDesktopUpdates,
  getDesktopUpdateRuntime,
  installDesktopUpdate,
  installStudioAppUpdate,
  subscribeToDesktopUpdateStatus,
} from "../lib/desktop-update-bridge";

import { reportCaughtError } from "../lib/fail-safe-runtime-capture";

export const STUDIO_UPDATE_CHECK_STALL_MS = 20_000;

export function isStuckStudioUpdateProgress(status, pct) {
  return (pct == null || pct === 85) && /checking studio app update/i.test(String(status || ""));
}

/** Shared across hook instances (status bar + header controls). */
let silentUpdateStarted = false;
let updateCommandInFlight = false;

function noPublishedUpdateMessage(result) {
  const versions = result?.currentVersion && result?.version
    ? ` (installed ${result.currentVersion}, published ${result.version})`
    : "";
  return `No newer published Studio version${versions}. Local installers appear here only after a signed release is published.`;
}

/** @internal vitest only */
export function resetDesktopUpdateSilentFlagForTests() {
  silentUpdateStarted = false;
  updateCommandInFlight = false;
}

export function useDesktopUpdates() {
  // Always start as null so SSR HTML matches the first client paint (window.__TAURI__
  // exists in Studio but not during Next SSR). Detect the host after mount.
  const [runtime, setRuntime] = useState(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [progressPct, setProgressPct] = useState(null);
  const [currentVersion, setCurrentVersion] = useState(null);
  const [publishedVersion, setPublishedVersion] = useState(null);
  const hideTimerRef = useRef(null);

  const rememberVersions = useCallback((result) => {
    if (result?.currentVersion) setCurrentVersion(result.currentVersion);
    if (result?.version) setPublishedVersion(result.version);
  }, []);

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

  const showUpdateError = useCallback(
    (message) => {
      clearHideTimer();
      setBusy(false);
      setProgressPct(null);
      setStatus(message);
    },
    [clearHideTimer],
  );

  const checkUpdates = useCallback(
    async ({ automatic = false } = {}) => {
      if (!runtime) return null;
      clearHideTimer();
      setBusy(true);
      if (!automatic) {
        setProgressPct(null);
        setStatus("Checking for updates…");
      }
      try {
        const result = await checkForDesktopUpdates();
        rememberVersions(result);
        if (!result?.ok) {
          if (!automatic) showUpdateError(result?.error || "Update check failed");
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
          setStatus(noPublishedUpdateMessage(result));
          setBusy(false);
          setProgressPct(null);
        } else {
          hideStatus();
        }
        return result;
      } catch (error) {
        if (!automatic) {
          showUpdateError(error instanceof Error ? error.message : "Update check failed");
        } else {
          hideStatus();
        }
        return null;
      }
    },
    [clearHideTimer, hideStatus, rememberVersions, runtime, showUpdateError],
  );

  const updateApp = useCallback(async () => {
    if (!runtime || updateCommandInFlight) return null;
    updateCommandInFlight = true;
    clearHideTimer();
    setBusy(true);
    setProgressPct(null);
    setStatus("Checking for a signed Studio app update…");
    try {
      const result = await installStudioAppUpdate();
      rememberVersions(result);
      if (!result?.ok) {
        showUpdateError(result?.error || "Studio app update failed");
      } else {
        setBusy(false);
        setProgressPct(null);
        setStatus(result.available ? "Studio installer started. Waiting for restart…" : noPublishedUpdateMessage(result));
      }
      return result;
    } catch (error) {
      showUpdateError(error instanceof Error ? error.message : "Studio app update failed");
      return null;
    } finally {
      updateCommandInFlight = false;
    }
  }, [clearHideTimer, rememberVersions, runtime, showUpdateError]);

  const updateAll = useCallback(async () => {
    if (!runtime || updateCommandInFlight) return null;
    updateCommandInFlight = true;
    clearHideTimer();
    setBusy(true);
    setProgressPct(null);
    setStatus("Checking Studio first, then updating addons and tools…");
    try {
      const result = await installDesktopUpdate();
      rememberVersions(result);
      if (!result?.ok) {
        showUpdateError(result?.error || result?.summary || "Update installation failed");
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
      showUpdateError(error instanceof Error ? error.message : "Update installation failed");
      return null;
    } finally {
      updateCommandInFlight = false;
    }
  }, [clearHideTimer, hideStatus, rememberVersions, runtime, showUpdateError]);

  const runSilentUpdate = useCallback(async () => {
    if (!runtime || silentUpdateStarted || updateCommandInFlight) return;
    silentUpdateStarted = true;
    updateCommandInFlight = true;
    try {
      const check = await checkForDesktopUpdates();
      rememberVersions(check);
      if (!check?.ok) {
        showUpdateError(check?.error || "Could not check for a Studio app update");
        return;
      }
      if (!check.available) return;
      clearHideTimer();
      setBusy(true);
      setProgressPct(null);
      setStatus(
        check.version
          ? `Downloading Studio update v${check.version}…`
          : "Downloading Studio update…",
      );
      const result = await installStudioAppUpdate();
      if (!result?.ok) {
        showUpdateError(result?.error || "Update failed");
        return;
      }
      hideStatus();
    } catch (error) {
      showUpdateError(error instanceof Error ? error.message : "Update failed");
    } finally {
      updateCommandInFlight = false;
    }
  }, [clearHideTimer, hideStatus, rememberVersions, runtime, showUpdateError]);

  useEffect(() => {
    if (!runtime) return undefined;
    const unsubscribe = subscribeToDesktopUpdateStatus((payload) => {
      if (!payload) return;
      const message = typeof payload.message === "string" ? payload.message.trim() : "";
      if (payload.phase === "studio-error" || payload.phase === "update-error") {
        showUpdateError(message || "Studio update failed");
        return;
      }
      if (message) setStatus(message);
      if (typeof payload.pct === "number" && Number.isFinite(payload.pct)) {
        setProgressPct(Math.max(0, Math.min(100, Math.round(payload.pct))));
      } else {
        setProgressPct(null);
      }
      // Status bar and header each own hook state. Finish events must dismiss the bar
      // here — only the instance that called updateAll schedules hideStatus otherwise.
      const finished =
        payload.phase === "update-complete" || /update check finished/i.test(message);
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
  }, [clearHideTimer, hideStatus, runSilentUpdate, runtime, showUpdateError]);

  useEffect(() => {
    if (!busy || !isStuckStudioUpdateProgress(status, progressPct)) return undefined;
    const timer = setTimeout(() => {
      reportCaughtError(
        "desktop.update.studio-check",
        new Error(status || "Studio update check stalled"),
      );
      showUpdateError("Studio update check timed out — GitHub did not respond");
    }, STUDIO_UPDATE_CHECK_STALL_MS);
    return () => clearTimeout(timer);
  }, [busy, progressPct, showUpdateError, status]);

  return {
    available: Boolean(runtime),
    visible: Boolean(runtime) && (busy || Boolean(status)),
    status,
    busy,
    progressPct,
    currentVersion,
    publishedVersion,
    installReady: runtime === "tauri",
    installLabel: "Update all",
    checkUpdates,
    updateApp,
    updateAll,
  };
}
