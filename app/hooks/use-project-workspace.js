"use client";

import { useCallback } from "react";
import { pickPipelineInputFields } from "../lib/workspace-bindings-input";
import { useAnalyzers } from "./use-analyzers";
import { useClipboard } from "./use-clipboard";
import { usePipelineInput } from "./use-pipeline-input";
import { useProjectSnapshot } from "./use-project-snapshot";
import { useProjectState } from "./use-project-state";
import { useSnapshotFields } from "./use-snapshot-fields";
import { useSplashAutoDismiss, useSplashOverlay } from "./use-splash-seen";
import { useStatusMessage } from "./use-status-message";
import { useWorkspaceBindings } from "./use-workspace-bindings";
import { APP_VERSION } from "../lib/music-config";

/**
 * Orchestrates project state, analyzers, persistence, prompts, actions, and workspace context value.
 */
export function useProjectWorkspaceProvider() {
  const {
    statusMessage: saveStatus,
    setStatusMessage,
    setStatusWithTime,
    toast,
    clearToast,
  } = useStatusMessage("Not saved yet");
  const projectState = useProjectState();
  const { patch } = projectState;
  const { showSplash, dismissSplash, resetSplash } = useSplashOverlay();
  useSplashAutoDismiss(showSplash, dismissSplash);

  const applyAnalyzerPatch = useCallback(
    (analyzerPatch) => {
      patch(analyzerPatch);
    },
    [patch],
  );

  const analyzers = useAnalyzers({
    promptEngine: projectState.promptEngine,
    setGuidedStep: projectState.setGuidedStep,
    applyAnalyzerPatch,
    setStatusWithTime,
    idea: projectState.idea,
    lyricTheme: projectState.lyricTheme,
  });

  const snapshotFields = useSnapshotFields(projectState.state, {
    audioAnalysis: analyzers.audioAnalysis,
    imageAnalysis: analyzers.imageAnalysis,
  });

  const snapshot = useProjectSnapshot({
    appVersion: APP_VERSION,
    snapshotFields,
    loadProjectState: projectState.load,
    setAudioAnalysis: analyzers.setAudioAnalysis,
    clearAudioAnalysis: analyzers.clearAudioAnalysis,
    setImageAnalysis: analyzers.setImageAnalysis,
    clearImageAnalysis: analyzers.clearImageAnalysis,
    resetAnalyzers: analyzers.resetAnalyzers,
    patch: projectState.patch,
    promptEngine: projectState.promptEngine,
    setCustomPresets: projectState.setCustomPresets,
    setGuidedStep: projectState.setGuidedStep,
    setHistory: projectState.setHistory,
    setStatusMessage,
    setStatusWithTime,
  });

  const pipeline = usePipelineInput(
    pickPipelineInputFields(projectState, analyzers),
  );

  const scores = projectState.scores;
  const avgScore = ((scores.bass + scores.rhythm + scores.identity + scores.clarity) / 4).toFixed(1);
  const { copyToClipboard } = useClipboard(setStatusWithTime);

  const workspace = useWorkspaceBindings({
    projectState,
    analyzers,
    pipeline,
    snapshot,
    avgScore,
    copyToClipboard,
    resetSplash,
    setStatusWithTime,
  });

  return {
    avgScore,
    canvasRef: analyzers.canvasRef,
    clearToast,
    dismissSplash,
    saveStatus,
    setStatusWithTime,
    showSplash,
    toast,
    workspace,
  };
}
