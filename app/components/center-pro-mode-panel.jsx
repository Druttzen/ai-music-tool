"use client";

import { memo } from "react";
import { Panel, TextBox } from "./ui-blocks";
import {
  useProjectWorkspaceActions,
  useProjectWorkspaceProjectState,
} from "../context/project-workspace-context";

export const CenterProModePanel = memo(function CenterProModePanel() {
  const { proMode, tempo, structure, rules, notes } = useProjectWorkspaceProjectState();
  const { setTempo, setStructure, setRules, setNotes } = useProjectWorkspaceActions();
  if (!proMode) return null;

  return (
    <Panel title="Advanced Override" hint="Optional text editing for exact control.">
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
