"use client";

import { memo } from "react";
import { VariationCompare } from "./variation-compare";
import { Panel } from "./ui-blocks";
import {
  useProjectWorkspaceActions,
  useProjectWorkspaceProjectState,
} from "../context/project-workspace-context";

export const CenterVariationsPanel = memo(function CenterVariationsPanel() {
  const { variationCount, variations } = useProjectWorkspaceProjectState();
  const { generateVariations, copyToClipboard, setNotes, setStatusWithTime } =
    useProjectWorkspaceActions();

  return (
    <Panel title="Variation Engine" hint="Auto-generate prompt versions while keeping your core identity.">
      <button
        onClick={generateVariations}
        className="w-full rounded-2xl bg-fuchsia-300 px-4 py-2 font-bold text-black hover:bg-fuchsia-200"
      >
        Generate {variationCount} Variations
      </button>
      {variations.length > 0 && (
        <>
          <VariationCompare
            key={variations.map((v) => v.id).join("-")}
            variations={variations}
            onCopy={copyToClipboard}
            onApplyWinner={(text) => {
              setNotes(text.slice(0, 2000));
              setStatusWithTime("Variation A seeded into Notes");
            }}
          />
          <div className="mt-3 space-y-3">
            {variations.map((v) => (
              <div key={v.id} className="rounded-2xl border border-white/10 bg-black/30 p-3">
                <div className="mb-2 font-bold text-fuchsia-200">{v.title}</div>
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-xs text-white/70">{v.prompt}</pre>
                <button
                  onClick={() => copyToClipboard(v.prompt, `${v.title} copied`)}
                  className="mt-2 rounded-xl bg-white px-3 py-1 text-xs font-bold text-black hover:bg-cyan-100"
                >
                  Copy Variation
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </Panel>
  );
});
