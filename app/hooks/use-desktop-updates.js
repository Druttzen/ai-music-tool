"use client";

import { useCallback, useEffect, useState } from "react";
import {
  checkForDesktopUpdates,
  getDesktopUpdateRuntime,
  installDesktopUpdate,
  subscribeToDesktopUpdateStatus,
} from "../lib/desktop-update-bridge";

export function useDesktopUpdates() {
  const [runtime] = useState(getDesktopUpdateRuntime);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

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
          ? `Update available: v${result.version}`
          : "You are on the latest release.",
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
        setStatus("Update available — downloading…");
      }
      if (payload?.status === "downloaded") {
        setDownloaded(true);
        setStatus(payload.message || "Update ready — restart to install.");
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
    setStatus(runtime === "tauri" ? "Downloading and installing update…" : "Restarting to install…");
    try {
      const result = await installDesktopUpdate();
      if (!result?.ok) setStatus(result?.error || "Update installation failed");
      else if (!result.available) {
        setUpdateAvailable(false);
        setStatus("You are on the latest release.");
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
    installReady: runtime === "tauri" ? updateAvailable : downloaded,
    installLabel: runtime === "tauri" ? "Download and restart" : "Restart to install",
    checkUpdates,
    restartToUpdate,
  };
}
