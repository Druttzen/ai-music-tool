"use client";

import { useEffect } from "react";
import { normalizeAudioAnalysis, normalizeHighlightRange } from "../../lib/audio-analyzer";

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
      setAudioAnalysis((prev) => {
        if (!prev) return prev;
        const merged = { ...prev, ...detail };
        if ("highlightStart" in detail || "highlightEnd" in detail) {
          const norm = normalizeHighlightRange(
            merged.duration,
            merged.highlightStart,
            merged.highlightEnd,
          );
          merged.highlightStart = norm.highlightStart;
          merged.highlightEnd = norm.highlightEnd;
          if (!detail.highlightLabel) merged.highlightLabel = "Custom highlight section";
        }
        return normalizeAudioAnalysis(merged);
      });
    };
    window.addEventListener("aimc-e2e-patch-audio-analysis", patchHandler);
    return () => {
      window.removeEventListener("aimc-e2e-set-audio-analysis", handler);
      window.removeEventListener("aimc-e2e-patch-audio-analysis", patchHandler);
    };
  }, [setAudioAnalysis]);
}
