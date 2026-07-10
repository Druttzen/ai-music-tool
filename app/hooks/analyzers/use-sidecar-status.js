"use client";

import { useEffect, useState } from "react";
import {
  resolveSidecarAiStatus,
  resolveSidecarGenerateAvailable,
  sidecarProbeDelayMs,
} from "../../lib/analyzers-sidecar-probe";
import {
  fetchSidecarHealth,
  getManagedSidecarStatus,
  isSidecarAvailable,
  resetSidecarHealthCache,
} from "../../lib/sidecar-bridge";
import { isTauriApp } from "../../lib/dsp-bridge";

export function useSidecarStatus() {
  const [sidecarAiStatus, setSidecarAiStatus] = useState("checking");
  const [sidecarGenerateAvailable, setSidecarGenerateAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer = null;

    const scheduleNext = (status) => {
      if (cancelled) return;
      timer = setTimeout(() => {
        void probeSidecar();
      }, sidecarProbeDelayMs(status));
    };

    const probeSidecar = async () => {
      if (cancelled) return;
      setSidecarAiStatus("checking");
      let nextStatus = "offline";
      try {
        resetSidecarHealthCache();
        const httpOk = await isSidecarAvailable();
        let health = null;
        if (httpOk) {
          try {
            health = await fetchSidecarHealth();
          } catch {
            health = null;
          }
        }
        let tauriManaged = null;
        if (!httpOk && isTauriApp()) {
          tauriManaged = await getManagedSidecarStatus();
        }
        nextStatus = resolveSidecarAiStatus({
          httpOk,
          tauriManaged,
          isTauri: isTauriApp(),
        });
        if (!cancelled) {
          setSidecarGenerateAvailable(resolveSidecarGenerateAvailable({ health }));
          setSidecarAiStatus(nextStatus);
        }
      } catch {
        if (!cancelled) {
          setSidecarAiStatus("offline");
          setSidecarGenerateAvailable(false);
        }
      }
      scheduleNext(nextStatus);
    };

    void probeSidecar();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  return { sidecarAiStatus, sidecarGenerateAvailable, setSidecarGenerateAvailable };
}
