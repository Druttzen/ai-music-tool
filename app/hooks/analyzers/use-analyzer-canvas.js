"use client";

import { useCallback } from "react";
import {
  deriveCanvasMotionHint,
  deriveCanvasTrackMeta,
  openImageInCanvasTool,
} from "../../lib/suite-canvas-client";
import { reportCaughtError } from "../../lib/fail-safe-runtime-capture";

export function useAnalyzerCanvas({
  imagePreview,
  audioPreviewUrl,
  audioAnalysis,
  imageAnalysis,
  idea,
  lyricTheme,
  setStatusWithTime,
}) {
  const openInCanvasTool = useCallback(async () => {
    if (!imagePreview) {
      setStatusWithTime("Drop an image first to open in Canvas Tool");
      return;
    }
    try {
      setStatusWithTime("Opening AI Canvas Tool…");
      const { title, artist } = deriveCanvasTrackMeta({
        idea,
        lyricTheme,
        audioAnalysis,
        imageAnalysis,
      });
      const motionHint = deriveCanvasMotionHint(imageAnalysis);
      const ext = (imageAnalysis?.fileName || "").split(".").pop() || "png";
      const audioExt = (audioAnalysis?.fileName || "").split(".").pop() || "mp3";
      const result = await openImageInCanvasTool({
        imagePreviewUrl: imagePreview,
        audioPreviewUrl: audioPreviewUrl || undefined,
        title,
        artist,
        motionHint,
        ext,
        audioExt,
      });
      if (result?.ok) {
        setStatusWithTime(
          result.launched
            ? audioPreviewUrl
              ? "AI Canvas Tool opened — artwork + track imported"
              : "AI Canvas Tool opened — artwork imported"
            : "Artwork exported — exports opened. Install AI Canvas Tool to launch automatically",
        );
      } else {
        setStatusWithTime(result?.error || "Could not open Canvas Tool", "error");
      }
    } catch (err) {
      reportCaughtError("analyzers.openInCanvasTool", err);
      setStatusWithTime(
        err instanceof Error ? err.message : "Could not open Canvas Tool",
        "error",
      );
    }
  }, [
    audioAnalysis,
    audioPreviewUrl,
    idea,
    imageAnalysis,
    imagePreview,
    lyricTheme,
    setStatusWithTime,
  ]);

  return { openInCanvasTool };
}
