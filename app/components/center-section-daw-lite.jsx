"use client";

import { memo } from "react";
import { Panel } from "./ui-blocks";
import {
  useProjectWorkspaceActions,
  useProjectWorkspaceProjectState,
} from "../context/project-workspace-context";
import { buildMoodWords } from "../lib/music-helpers";
import { generateSunoMetatagScaffold } from "../lib/suno-metatag-generator";

const SECTIONS = ["intro", "verse", "pre-chorus", "chorus", "bridge", "outro"];

export const CenterSectionDawLite = memo(function CenterSectionDawLite() {
  const { structure, mood } = useProjectWorkspaceProjectState();
  const moodWords = buildMoodWords(mood)
    .split(/,\s*/)
    .filter(Boolean);
  const { setStructure, setGeneratedLyrics, copyToClipboard, setStatusWithTime } =
    useProjectWorkspaceActions();

  const parts = String(structure || "")
    .split(/→|->/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const applyScaffold = () => {
    const scaffold = generateSunoMetatagScaffold({
      structure: structure || "intro → verse → chorus → verse → chorus → outro",
      moodWords: moodWords.slice(0, 2),
    });
    setGeneratedLyrics(scaffold);
    setStatusWithTime("Section metatag scaffold inserted into lyrics");
  };

  return (
    <Panel
      title="Section DAW (lite)"
      hint="Suno-native section lanes — tap to extend structure, then generate metatags."
      data-testid="section-daw-lite"
    >
      <div className="flex flex-wrap gap-2">
        {SECTIONS.map((sec) => (
          <button
            key={sec}
            type="button"
            onClick={() => {
              const next = parts.length ? `${structure} → ${sec}` : sec;
              setStructure(next.replace(/\s*→\s*→\s*/g, " → "));
            }}
            className="rounded-xl border border-violet-300/30 bg-violet-950/30 px-3 py-1.5 text-[11px] font-bold text-violet-100 hover:bg-violet-900/40"
          >
            + {sec}
          </button>
        ))}
      </div>
      <p className="mt-3 rounded-xl border border-white/10 bg-black/30 p-2 font-mono text-[11px] text-white/70">
        {structure || "intro → verse → chorus → outro"}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={applyScaffold}
          className="rounded-2xl bg-violet-300 px-4 py-2 text-sm font-bold text-black hover:bg-violet-200"
        >
          Insert metatag scaffold
        </button>
        <button
          type="button"
          onClick={() =>
            copyToClipboard(
              generateSunoMetatagScaffold({ structure, moodWords: moodWords.slice(0, 2) }),
              "Metatags copied",
            )
          }
          className="rounded-2xl border border-white/15 px-4 py-2 text-sm font-bold text-white hover:bg-white/10"
        >
          Copy metatags
        </button>
      </div>
    </Panel>
  );
});
