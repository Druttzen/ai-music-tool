"use client";

import { useEffect } from "react";
import { normalizeAudioAnalysis } from "../../lib/audio-analyzer";

/** Dev/e2e hooks: inject or patch audio analysis via window events. */
export function useE2eAudioFixtures(setAudioAnalysis) {
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const handler = (event) => {
      const detail = event?.detail;
      if (!detail || typeof detail !== "object") return;
      setAudioAnalysis(normalizeAudioAnalysis(detail));
    };
    window.addEventListener("aimc-e2e-set-audio-analysis", handler);
    const patchHandler = (event) => {
      const detail = event?.detail;
      if (!detail || typeof detail !== "object") return;
      setAudioAnalysis((prev) => (prev ? normalizeAudioAnalysis({ ...prev, ...detail }) : prev));
    };
    window.addEventListener("aimc-e2e-patch-audio-analysis", patchHandler);
    return () => {
      window.removeEventListener("aimc-e2e-set-audio-analysis", handler);
      window.removeEventListener("aimc-e2e-patch-audio-analysis", patchHandler);
    };
  }, [setAudioAnalysis]);
}
