"use client";

import { useMemo } from "react";
import { buildProjectWorkspaceAnalyzerState } from "../../lib/project-workspace-value";

const ANALYZER_KEYS = [
  "audioAnalysis",
  "audioExportBusy",
  "audioExportProgress",
  "audioLoudness",
  "audioLoudnessBusy",
  "audioPreviewUrl",
  "generateMusicBusy",
  "imageAnalysis",
  "imagePreview",
  "sidecarAiStatus",
  "sidecarGenerateAvailable",
  "stemSeparationBusy",
  "stemSeparationStems",
];

export function useWorkspaceAnalyzerStateSlice(source) {
  return useMemo(
    () => buildProjectWorkspaceAnalyzerState(pick(source, ANALYZER_KEYS)),
    [source],
  );
}

function pick(source, keys) {
  const out = {};
  for (const k of keys) out[k] = source[k];
  return out;
}
