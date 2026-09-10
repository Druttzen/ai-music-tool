"use client";

import { useCallback } from "react";
import {
  resolveSidecarAcestepAvailable,
  resolveSidecarGenerateAvailable,
  resolveSidecarStemsMelbandAvailable,
  resolveSidecarVocalTransformAvailable,
} from "../lib/analyzers-sidecar-probe";
import { waitForSidecarExtraReady, fetchSidecarHealthAfterExtraInstall } from "../lib/sidecar-extra-install-client";
import { useAnalyzerRefs } from "./analyzers/use-analyzer-refs";
import { useSidecarStatus } from "./analyzers/use-sidecar-status";
import { useAnalyzerMedia } from "./analyzers/use-analyzer-media";
import { useAnalyzerExport } from "./analyzers/use-analyzer-export";
import { useAnalyzerStems } from "./analyzers/use-analyzer-stems";
import { useAnalyzerGenerate } from "./analyzers/use-analyzer-generate";
import { useAnalyzerVocals } from "./analyzers/use-analyzer-vocals";
import { useLocalCoverRemix } from "./analyzers/use-local-cover-remix";
import { useAnalyzerCanvas } from "./analyzers/use-analyzer-canvas";

export function useAnalyzers({
  promptEngine,
  setGuidedStep,
  applyAnalyzerPatch,
  setStatusWithTime,
  idea = "",
  lyricTheme = "",
  coProducerLlmSettings = null,
}) {
  const refs = useAnalyzerRefs();
  const {
    sidecarAiStatus,
    sidecarGenerateAvailable,
    setSidecarGenerateAvailable,
    sidecarAcestepAvailable,
    setSidecarAcestepAvailable,
    sidecarStemsMelbandAvailable,
    setSidecarStemsMelbandAvailable,
    sidecarVocalTransformAvailable,
    setSidecarVocalTransformAvailable,
  } = useSidecarStatus();

  const refreshSidecarCapabilities = useCallback(async (options) => {
    const health = options?.waitForExtraId
      ? await waitForSidecarExtraReady(options.waitForExtraId, options)
      : await fetchSidecarHealthAfterExtraInstall();
    setSidecarGenerateAvailable(resolveSidecarGenerateAvailable({ health }));
    setSidecarAcestepAvailable(resolveSidecarAcestepAvailable({ health }));
    setSidecarStemsMelbandAvailable(resolveSidecarStemsMelbandAvailable({ health }));
    setSidecarVocalTransformAvailable(resolveSidecarVocalTransformAvailable({ health }));
    return health;
  }, [
    setSidecarGenerateAvailable,
    setSidecarAcestepAvailable,
    setSidecarStemsMelbandAvailable,
    setSidecarVocalTransformAvailable,
  ]);

  const media = useAnalyzerMedia({
    promptEngine,
    setGuidedStep,
    applyAnalyzerPatch,
    setStatusWithTime,
    coProducerLlmSettings,
    refs,
  });

  const {
    audioExportBusy,
    audioExportProgress,
    exportEnhancedAudio,
  } = useAnalyzerExport({
    audioAnalysis: media.audioAnalysis,
    audioPreviewUrlRef: media.audioPreviewUrlRef,
    setStatusWithTime,
  });

  const stems = useAnalyzerStems({
    audioAnalysis: media.audioAnalysis,
    setStatusWithTime,
  });

  const {
    generateMusicBusy,
    generateMusicFromPrompt,
    generateSongBusy,
    generateSongFromPrompt,
  } = useAnalyzerGenerate({
    audioAnalysis: media.audioAnalysis,
    setAudioAnalysis: media.setAudioAnalysis,
    setAudioPreviewFromBlob: media.setAudioPreviewFromBlob,
    syncCacheKeysRef: media.syncCacheKeysRef,
    audioPreviewUrlRef: media.audioPreviewUrlRef,
    applyAnalyzerPatch,
    promptEngine,
    setGuidedStep,
    setSidecarGenerateAvailable,
    setSidecarAcestepAvailable,
    setStatusWithTime,
  });

  const {
    vocalTransformBusy,
    transformVocalsOnTrack,
  } = useAnalyzerVocals({
    audioAnalysis: media.audioAnalysis,
    setAudioAnalysis: media.setAudioAnalysis,
    setAudioPreviewFromBlob: media.setAudioPreviewFromBlob,
    syncCacheKeysRef: media.syncCacheKeysRef,
    audioPreviewUrlRef: media.audioPreviewUrlRef,
    setSidecarVocalTransformAvailable,
    setStatusWithTime,
  });

  const {
    localCoverRemixBusy,
    runLocalCoverRemix,
  } = useLocalCoverRemix({
    audioAnalysis: media.audioAnalysis,
    setAudioAnalysis: media.setAudioAnalysis,
    setAudioPreviewFromBlob: media.setAudioPreviewFromBlob,
    syncCacheKeysRef: media.syncCacheKeysRef,
    audioPreviewUrlRef: media.audioPreviewUrlRef,
    setStatusWithTime,
  });

  const { openInCanvasTool } = useAnalyzerCanvas({
    imagePreview: media.imagePreview,
    audioPreviewUrl: media.audioPreviewUrl,
    audioAnalysis: media.audioAnalysis,
    imageAnalysis: media.imageAnalysis,
    idea,
    lyricTheme,
    setStatusWithTime,
  });

  const { reset: resetMedia } = media;
  const { clearStems } = stems;
  const resetAnalyzers = useCallback(() => {
    resetMedia();
    clearStems();
  }, [resetMedia, clearStems]);

  return {
    attachAudioFile: media.attachAudioFile,
    analyzeAudioFile: media.analyzeAudioFile,
    analyzeImageFile: media.analyzeImageFile,
    applyAudioToSunoStyle: media.applyAudioToSunoStyle,
    applyImageToSunoStyle: media.applyImageToSunoStyle,
    audioAnalysis: media.audioAnalysis,
    audioExportBusy,
    audioExportProgress,
    audioLoudness: media.audioLoudness,
    audioLoudnessBusy: media.audioLoudnessBusy,
    audioStereoPhase: media.audioStereoPhase,
    audioPreviewUrl: media.audioPreviewUrl,
    canvasRef: media.canvasRef,
    exportEnhancedAudio,
    clearAudioAnalysis: media.clearAudioAnalysis,
    clearImageAnalysis: media.clearImageAnalysis,
    downloadStem: stems.downloadStem,
    generateMusicBusy,
    generateMusicFromPrompt,
    generateSongBusy,
    generateSongFromPrompt,
    vocalTransformBusy,
    transformVocalsOnTrack,
    localCoverRemixBusy,
    runLocalCoverRemix,
    imageAnalysis: media.imageAnalysis,
    imagePreview: media.imagePreview,
    openInCanvasTool,
    refreshSidecarCapabilities,
    resetAnalyzers,
    setAudioAnalysis: media.setAudioAnalysisNormalized,
    setImageAnalysis: media.setImageAnalysis,
    separateStems: stems.separateStems,
    sidecarAiStatus,
    sidecarGenerateAvailable,
    sidecarAcestepAvailable,
    sidecarStemsMelbandAvailable,
    sidecarVocalTransformAvailable,
    stemSeparationBusy: stems.stemSeparationBusy,
    stemSeparationStems: stems.stemSeparationStems,
    updateAudioAnalysis: media.updateAudioAnalysis,
  };
}
