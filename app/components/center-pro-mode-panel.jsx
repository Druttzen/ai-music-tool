"use client";

import { memo, useMemo } from "react";
import { Panel, TextBox } from "./ui-blocks";
import {
  useProjectWorkspaceActions,
  useProjectWorkspaceProjectState,
  useProjectWorkspacePromptState,
} from "../context/project-workspace-context";
import { analyzeSunoPromptQuality } from "../lib/suno-prompt-critic";

export const CenterProModePanel = memo(function CenterProModePanel() {
  const { proMode, tempo, structure, rules, notes } = useProjectWorkspaceProjectState();
  const { sunoFieldSlices } = useProjectWorkspacePromptState();
  const { setTempo, setStructure, setRules, setNotes } = useProjectWorkspaceActions();
  const critic = useMemo(
    () => analyzeSunoPromptQuality(sunoFieldSlices?.style || "", sunoFieldSlices?.lyrics || ""),
    [sunoFieldSlices?.style, sunoFieldSlices?.lyrics],
  );
  if (!proMode) return null;

  return (
    <Panel title="Advanced Override" hint="Optional text editing for exact control.">
      <div
        className="mb-3 rounded-2xl border border-amber-400/25 bg-amber-500/10 p-3"
        data-testid="prompt-critic-panel"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-bold uppercase tracking-wider text-amber-100/90">
            Prompt critic
          </div>
          <div className="text-sm font-bold text-amber-50">
            {critic.score}/100 · {critic.grade}
          </div>
        </div>
        {critic.issues.length > 0 && (
          <ul className="mt-2 space-y-1 text-[11px] text-amber-100/85">
            {critic.issues.slice(0, 4).map((issue) => (
              <li key={issue.message}>• {issue.message}</li>
            ))}
          </ul>
        )}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label>
          <div className="mb-1 text-xs font-bold uppercase tracking-wider text-white/45">Tempo</div>
          <input
            value={tempo}
            onChange={(e) => setTempo(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-white outline-none"
          />
        </label>
        <label>
          <div className="mb-1 text-xs font-bold uppercase tracking-wider text-white/45">Structure</div>
          <input
            value={structure}
            onChange={(e) => setStructure(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-white outline-none"
          />
        </label>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <TextBox label="Rules" value={rules} setValue={setRules} />
        <TextBox label="Notes / Analyzer Output" value={notes} setValue={setNotes} />
      </div>
    </Panel>
  );
});
