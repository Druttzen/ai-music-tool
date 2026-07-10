"use client";

import { useCallback, useEffect, useRef } from "react";

/** Shared preview URL + cache refs for analyzer sub-hooks. */
export function useAnalyzerRefs() {
  const canvasRef = useRef(null);
  const imagePreviewUrlRef = useRef(null);
  const audioPreviewUrlRef = useRef(null);
  const audioCacheKeyRef = useRef(null);
  const audioCacheKeysRef = useRef([]);
  const audioAnalysisRef = useRef(null);
  const rehydrateGenRef = useRef(0);
  const loudnessGenRef = useRef(0);

  const setAudioPreviewFromBlob = useCallback((blob) => {
    if (audioPreviewUrlRef.current) URL.revokeObjectURL(audioPreviewUrlRef.current);
    const previewUrl = URL.createObjectURL(blob);
    audioPreviewUrlRef.current = previewUrl;
    return previewUrl;
  }, []);

  useEffect(() => {
    return () => {
      if (imagePreviewUrlRef.current) {
        URL.revokeObjectURL(imagePreviewUrlRef.current);
        imagePreviewUrlRef.current = null;
      }
      if (audioPreviewUrlRef.current) {
        URL.revokeObjectURL(audioPreviewUrlRef.current);
        audioPreviewUrlRef.current = null;
      }
    };
  }, []);

  return {
    audioAnalysisRef,
    audioCacheKeyRef,
    audioCacheKeysRef,
    audioPreviewUrlRef,
    canvasRef,
    imagePreviewUrlRef,
    loudnessGenRef,
    rehydrateGenRef,
    setAudioPreviewFromBlob,
  };
}
