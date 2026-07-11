"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchFailSafeCapabilities,
  fetchSidecarHealth,
  runFailSafeFixPush,
} from "../lib/sidecar-bridge";
import { getMaintainerGithubToken } from "../lib/maintainer-settings";

/**
 * In-app fail-safe fix + push (maintainer sidecar or cloud dispatch).
 */
export function useFailSafeFixPush() {
  const [available, setAvailable] = useState(false);
  const [maintainerMode, setMaintainerMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const refresh = useCallback(async () => {
    const [caps, health] = await Promise.all([
      fetchFailSafeCapabilities(),
      fetchSidecarHealth(),
    ]);
    const on =
      !!caps?.fix_push_available ||
      !!health?.fix_push_available ||
      !!caps?.maintainer_mode ||
      !!health?.maintainer_mode;
    setAvailable(on);
    setMaintainerMode(!!caps?.maintainer_mode || !!health?.maintainer_mode);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void refresh();
    }, 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  const fixAndPush = useCallback(
    async ({ mode = "local" } = {}) => {
      setBusy(true);
      try {
        const githubToken = mode === "cloud" ? getMaintainerGithubToken() : undefined;
        const result = await runFailSafeFixPush({ mode, githubToken });
        setLastResult(result);
        return result;
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const canCloud = !!getMaintainerGithubToken();

  return {
    available,
    maintainerMode,
    busy,
    lastResult,
    canCloud,
    refresh,
    fixAndPush,
  };
};
