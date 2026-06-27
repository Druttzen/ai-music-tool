"use client";

import { memo } from "react";
import { SunoGuidedPath } from "./suno-guided-path";
import {
  useProjectWorkspaceActions,
  useProjectWorkspaceProjectState,
  useProjectWorkspacePromptState,
} from "../context/project-workspace-context";

export const CenterGuidedPathPanel = memo(function CenterGuidedPathPanel() {
  const { promptEngine, vocal, instrumentalVocalFx, customPresets, guidedStep } =
    useProjectWorkspaceProjectState();
  const { sunoGuidedInput } = useProjectWorkspacePromptState();
  const {
    setPromptEngine,
    setStatusWithTime,
    copyToClipboard,
    setVocal,
    setInstrumentalVocalFx,
    setGuidedStep,
    applyPreset,
    loadPresetObject,
  } = useProjectWorkspaceActions();

  return (
    <SunoGuidedPath
      promptEngine={promptEngine}
      onSelectSunoEngine={() => {
        setPromptEngine("Suno-like");
        setStatusWithTime("Switched to Suno-like engine", "info");
      }}
      input={sunoGuidedInput}
      copyToClipboard={copyToClipboard}
      setStatusWithTime={setStatusWithTime}
      vocal={vocal}
      instrumentalVocalFx={instrumentalVocalFx}
      setVocal={setVocal}
      setInstrumentalVocalFx={setInstrumentalVocalFx}
      customPresets={customPresets}
      guidedStep={guidedStep}
      setGuidedStep={setGuidedStep}
      onApplyFactoryPreset={(name) => {
        applyPreset(name);
        setGuidedStep(0);
        setStatusWithTime(`Loaded preset: ${name} — guided path reset to step 1`);
      }}
      onLoadCustomPreset={(name) => {
        loadPresetObject(name, customPresets[name]);
        setGuidedStep(0);
        setStatusWithTime(`Loaded custom preset: ${name} — guided path reset to step 1`);
      }}
    />
  );
});
