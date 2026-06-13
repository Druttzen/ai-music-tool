"use client";

import { memo } from "react";
import { SunoGuidedPath } from "./suno-guided-path";
import { useProjectWorkspace } from "../context/project-workspace-context";

export const CenterGuidedPathPanel = memo(function CenterGuidedPathPanel() {
  const ws = useProjectWorkspace();

  return (
    <SunoGuidedPath
      promptEngine={ws.promptEngine}
      onSelectSunoEngine={() => {
        ws.setPromptEngine("Suno-like");
        ws.setStatusWithTime("Switched to Suno-like engine", "info");
      }}
      input={ws.sunoGuidedInput}
      copyToClipboard={ws.copyToClipboard}
      setStatusWithTime={ws.setStatusWithTime}
      vocal={ws.vocal}
      instrumentalVocalFx={ws.instrumentalVocalFx}
      setVocal={ws.setVocal}
      setInstrumentalVocalFx={ws.setInstrumentalVocalFx}
      customPresets={ws.customPresets}
      guidedStep={ws.guidedStep}
      setGuidedStep={ws.setGuidedStep}
      onApplyFactoryPreset={(name) => {
        ws.applyPreset(name);
        ws.setGuidedStep(0);
        ws.setStatusWithTime(`Loaded preset: ${name} — guided path reset to step 1`);
      }}
      onLoadCustomPreset={(name) => {
        ws.loadPresetObject(name, ws.customPresets[name]);
        ws.setGuidedStep(0);
        ws.setStatusWithTime(`Loaded custom preset: ${name} — guided path reset to step 1`);
      }}
    />
  );
});
