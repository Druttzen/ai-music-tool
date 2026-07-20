"use client";

import { memo } from "react";
import { Panel, Pill, Slider } from "./ui-blocks";
import { stylePresets } from "../lib/music-config";
import { GUIDED_PANEL_IDS } from "../lib/suno-guided-step-focus";
import { useGuidedFocus } from "../context/guided-focus-context";
import {
  useProjectWorkspaceActions,
  useProjectWorkspaceProjectState,
  useProjectWorkspacePromptState,
} from "../context/project-workspace-context";
import { GuidedFocusPanel } from "./guided-focus-panel";
import { SuiteAddonsPanel } from "./suite-addons-panel";

export const PageSidebarLeft = memo(function PageSidebarLeft() {
  const {
    customPresets,
    mode,
    presetName,
    proMode,
    promptIntensity,
    variationCount,
  } = useProjectWorkspaceProjectState();
  const { intensityText } = useProjectWorkspacePromptState();
  const { focused } = useGuidedFocus();
  const {
    applyPreset,
    deleteCustomPreset,
    exportProject,
    exportVideoHandoff,
    importProject,
    loadPresetObject,
    resetAll,
    revertSnapshot,
    saveCustomPreset,
    saveProject,
    setMode,
    setPresetName,
    setProMode,
    setPromptIntensity,
    setStatusWithTime,
    setVariationCount,
  } = useProjectWorkspaceActions();

  return (
    <aside className="space-y-4">
      <GuidedFocusPanel panelId={GUIDED_PANEL_IDS.stylePresets} column="left">
        <Panel title="Style Presets" hint="Load factory or custom styles.">
          <div className="space-y-2">
            {Object.keys(stylePresets).map((name) => (
              <button
                key={name}
                onClick={() => applyPreset(name)}
                className="w-full rounded-2xl border border-white/10 bg-black/25 p-3 text-left text-sm font-bold hover:border-cyan-300/50 hover:bg-cyan-300/10"
              >
                {name}
              </button>
            ))}
          </div>
          <div className="mt-4 rounded-2xl border border-orange-400/20 bg-orange-400/10 p-3">
            <div className="mb-2 text-xs font-bold uppercase tracking-wider text-orange-200">
              Save Current As Preset
            </div>
            <input
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Preset name..."
              className="mb-2 w-full rounded-xl border border-white/10 bg-black/30 p-2 text-sm text-white outline-none"
            />
            <button
              onClick={saveCustomPreset}
              className="w-full rounded-xl bg-orange-300 px-3 py-2 text-sm font-bold text-black hover:bg-orange-200"
            >
              Save As Preset
            </button>
          </div>
          {Object.keys(customPresets).length > 0 && (
            <div className="mt-4 space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-white/45">Custom Presets</div>
              {Object.entries(customPresets).map(([name, p]) => (
                <div key={name} className="rounded-2xl border border-white/10 bg-black/25 p-2">
                  <button
                    onClick={() => loadPresetObject(name, p)}
                    className="w-full text-left text-sm font-bold text-cyan-100"
                  >
                    {name}
                  </button>
                  <button
                    onClick={() => deleteCustomPreset(name)}
                    className="mt-2 text-xs font-bold text-red-300 hover:text-red-200"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </GuidedFocusPanel>

      <GuidedFocusPanel panelId={GUIDED_PANEL_IDS.saveLoad} column="left">
        <Panel
          title="Save / Load"
          hint="Export bundle includes project state, custom style presets, and voice character profile. Legacy flat JSON still imports."
        >
          <div className="grid gap-2">
            <button onClick={saveProject} className="rounded-2xl bg-emerald-300 px-4 py-2 font-bold text-black hover:bg-emerald-200">
              Save Progress
            </button>
            <button onClick={exportProject} className="rounded-2xl bg-cyan-300 px-4 py-2 font-bold text-black hover:bg-cyan-200">
              Export Bundle
            </button>
            <button
              onClick={() => exportVideoHandoff()}
              className="rounded-2xl bg-violet-300 px-4 py-2 font-bold text-black hover:bg-violet-200"
              title="Bundle v2 handoff for AI Video Creator — Path E when audio + image are analyzed"
            >
              Send to Video Creator
            </button>
            <label className="cursor-pointer rounded-2xl bg-white px-4 py-2 text-center font-bold text-black hover:bg-cyan-100">
              Import Bundle
              <input type="file" accept="application/json" onChange={importProject} className="hidden" />
            </label>
            <button
              onClick={revertSnapshot}
              className="rounded-2xl border border-amber-400/40 bg-amber-500/15 px-4 py-2 font-bold text-amber-100 hover:bg-amber-500/25"
            >
              Revert to last snapshot
            </button>
            <button
              onClick={resetAll}
              className="rounded-2xl bg-red-400 px-4 py-2 font-bold text-black hover:bg-red-300"
              title="Clears all preselected style, prompts, analyzers, and history"
            >
              Reset to Default
            </button>
          </div>
        </Panel>
      </GuidedFocusPanel>

      <SuiteAddonsPanel />

      <GuidedFocusPanel panelId={GUIDED_PANEL_IDS.mode} column="left">
        <Panel title="Mode" hint="Controls stability vs creativity.">
          <div className="grid grid-cols-3 gap-2">
            {["Control", "Hybrid", "Chaos"].map((m) => (
              <Pill
                key={m}
                active={mode === m}
                onClick={() => {
                  setMode(m);
                  setStatusWithTime(`Mode: ${m}`, "info");
                }}
              >
                {m}
              </Pill>
            ))}
          </div>
        </Panel>
      </GuidedFocusPanel>

      <GuidedFocusPanel panelId={GUIDED_PANEL_IDS.proModeLeft} column="left">
        <Panel title="Pro Mode" hint="Advanced controls and stronger prompt shaping.">
          <button
            onClick={() => {
              const next = !proMode;
              setProMode(next);
              setStatusWithTime(next ? "Pro Mode enabled" : "Pro Mode disabled", "info");
            }}
            className={
              "w-full rounded-2xl px-4 py-2 font-bold transition active:scale-[0.98] " +
              (proMode ? "bg-purple-300 text-black" : "bg-black/40 text-white border border-white/10")
            }
          >
            {proMode ? "Pro Mode ON" : "Pro Mode OFF"}
          </button>
          {proMode && (
            <div className="mt-3 space-y-3">
              <Slider
                label="Prompt Intensity"
                value={promptIntensity}
                left="safe"
                right="experimental"
                setValue={setPromptIntensity}
              />
              <Slider
                label="Variations"
                value={variationCount}
                left="1"
                right="8"
                min={1}
                max={8}
                setValue={setVariationCount}
              />
              <div className="rounded-2xl border border-purple-300/20 bg-purple-300/10 p-3 text-xs text-purple-100">
                {intensityText}
              </div>
            </div>
          )}
        </Panel>
      </GuidedFocusPanel>

      {focused ? (
        <p className="text-[10px] leading-relaxed text-white/35">
          Other left-column tools are hidden while you focus on the current Suno step.
        </p>
      ) : null}
    </aside>
  );
});
