"use client";

import { useCallback, useEffect, useState } from "react";
import {
  checkForDesktopUpdates,
  getDesktopUpdateRuntime,
  installDesktopUpdate,
  subscribeToDesktopUpdateStatus,
} from "../lib/desktop-update-bridge";

export function useDesktopUpdates() {
  // Always start as null so SSR HTML matches the first client paint (window.__TAURI__
  // exists in Studio but not during Next SSR). Detect the host after mount.
  const [runtime, setRuntime] = useState(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setRuntime(getDesktopUpdateRuntime());
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const checkUpdates = useCallback(async ({ automatic = false } = {}) => {
    if (!runtime) return;
    setBusy(true);
    if (!automatic) setStatus("Checking for updates…");
    try {
      const result = await checkForDesktopUpdates();
      if (!result?.ok) {
        setStatus(result?.error || "Update check failed");
        return;
      }
      setUpdateAvailable(Boolean(result.available));
      setStatus(
        result.available
          ? `Studio update available: v${result.version}. Update all also refreshes addons, plugins, tools, and archives.`
          : "Studio is current. Update all still refreshes addons, plugins, tools, and archives.",
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Update check failed");
    } finally {
      setBusy(false);
    }
  }, [runtime]);

  useEffect(() => {
    if (!runtime) return undefined;
    const unsubscribe = subscribeToDesktopUpdateStatus((payload) => {
      if (payload?.status === "available") {
        setUpdateAvailable(true);
        setStatus("Studio update available — downloading…");
      }
      if (payload?.status === "downloaded") {
        setDownloaded(true);
        setStatus(payload.message || "Studio update ready — restart to install.");
      }
      if (payload?.message && payload?.phase) {
        setStatus(payload.message);
      }
    });
    const timer = setTimeout(() => void checkUpdates({ automatic: true }), 1500);
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [checkUpdates, runtime]);

  const restartToUpdate = useCallback(async () => {
    setBusy(true);
    setStatus(
      runtime === "tauri"
        ? "Updating addons, plugins, tools, archives, and Studio…"
        : "Restarting to install…",
    );
    try {
      const result = await installDesktopUpdate();
      if (!result?.ok) setStatus(result?.error || "Update installation failed");
      else {
        setUpdateAvailable(Boolean(result.available));
        setStatus(result.summary || (result.available ? "Studio update installed." : "Addons, plugins, tools, and archives are current."));
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Update installation failed");
    } finally {
      setBusy(false);
    }
  }, [runtime]);

  return {
    available: Boolean(runtime),
    status,
    busy,
    installReady: runtime === "tauri" ? true : downloaded,
    installLabel: runtime === "tauri" ? "Update all" : "Restart to install",
    checkUpdates,
    restartToUpdate,
  };
}
