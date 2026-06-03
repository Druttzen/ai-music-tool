"use client";

import { useCallback, useEffect, useState } from "react";
import {
  checkForAppUpdates,
  isElectronApp,
  quitAndInstallUpdate,
  subscribeToUpdateStatus,
} from "../lib/electron-bridge";

/**
 * Desktop auto-update controls (Electron packaged builds only).
 */
export function useElectronUpdates() {
  const [available, setAvailable] = useState(isElectronApp());
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  useEffect(() => {
    if (!isElectronApp()) return undefined;
    return subscribeToUpdateStatus((payload) => {
      if (payload?.status === "available") {
        setStatus("Update available — downloading…");
      }
      if (payload?.status === "downloaded") {
        setDownloaded(true);
        setStatus(payload.message || "Update ready — restart to install.");
      }
    });
  }, []);

  const checkUpdates = useCallback(async () => {
    if (!isElectronApp()) return;
    setBusy(true);
    setStatus("Checking for updates…");
    try {
      const result = await checkForAppUpdates();
      if (!result.ok) {
        setStatus(result.error || "Update check failed");
        return;
      }
      if (result.version) {
        setStatus(`Update available: v${result.version}`);
      } else {
        setStatus("You are on the latest release.");
      }
    } finally {
      setBusy(false);
    }
  }, []);

  const restartToUpdate = useCallback(async () => {
    setBusy(true);
    try {
      await quitAndInstallUpdate();
    } finally {
      setBusy(false);
    }
  }, []);

  return { available, status, busy, downloaded, checkUpdates, restartToUpdate };
}
