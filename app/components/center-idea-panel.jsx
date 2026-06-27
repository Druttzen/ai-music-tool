"use client";

import { memo } from "react";
import { Panel } from "./ui-blocks";
import { useProjectWorkspaceActions, useProjectWorkspaceProjectState } from "../context/project-workspace-context";

export const CenterIdeaPanel = memo(function CenterIdeaPanel() {
  const { idea } = useProjectWorkspaceProjectState();
  const { setIdea } = useProjectWorkspaceActions();

  return (
    <Panel title="Step 1 — Idea Input" hint="Describe what you want in plain language.">
      <input
        value={idea}
        onChange={(e) => setIdea(e.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-white outline-none focus:border-cyan-300"
      />
    </Panel>
  );
});
