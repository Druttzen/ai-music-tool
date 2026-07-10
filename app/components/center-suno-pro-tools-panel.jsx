"use client";

import { memo, useMemo } from "react";
import { Panel } from "./ui-blocks";
import {
  useProjectWorkspaceActions,
  useProjectWorkspaceProjectState,
  useProjectWorkspacePromptState,
} from "../context/project-workspace-context";
import { buildAlbumSequence, soundBibleFromProject } from "../lib/album-mode";
import { buildCustomModelPack } from "../lib/custom-model-pack";

const DEFAULT_ROLES = [
  { role: "opener", title: "Track 1 — Opener", idea: "" },
  { role: "single", title: "Track 2 — Single", idea: "" },
  { role: "closer", title: "Track 3 — Closer", idea: "" },
];

export const CenterSunoProToolsPanel = memo(function CenterSunoProToolsPanel() {
  const state = useProjectWorkspaceProjectState();
  const { sunoFieldSlices } = useProjectWorkspacePromptState();
  const { copyToClipboard, setStatusWithTime } = useProjectWorkspaceActions();

  const albumTracks = useMemo(
    () => buildAlbumSequence(soundBibleFromProject(state), DEFAULT_ROLES),
    [state],
  );

  const customPack = useMemo(
    () =>
      buildCustomModelPack([
        {
          title: state.idea || "Current project",
          artist: "You",
          bpm: state.tempo,
          key: "",
          genres: state.selectedGenres || [],
        },
      ]),
    [state],
  );

  return (
    <Panel
      title="Suno 5.5 Pro tools"
      hint="Album cohesion, Custom Model checklist, and multi-engine exports."
      data-testid="suno-pro-tools-panel"
    >
      <div className="space-y-4">
        <section className="rounded-2xl border border-fuchsia-400/25 bg-fuchsia-950/20 p-3">
          <div className="text-xs font-bold uppercase tracking-wider text-fuchsia-200/90">Album mode</div>
          <p className="mt-1 text-[11px] text-white/55">
            Shared sound bible: {(state.selectedGenres || []).slice(0, 2).join(" + ") || "set genres"} ·{" "}
            {state.tempo || "tempo ?"}
          </p>
          <div className="mt-2 space-y-2">
            {albumTracks.map((t) => (
              <div key={t.index} className="rounded-xl border border-white/10 bg-black/30 p-2">
                <div className="text-[11px] font-bold text-fuchsia-100">
                  {t.index}. {t.title} <span className="text-white/40">({t.role})</span>
                </div>
                <pre className="mt-1 max-h-16 overflow-auto whitespace-pre-wrap text-[10px] text-white/65">
                  {t.styleLine}
                </pre>
                <button
                  type="button"
                  onClick={() => copyToClipboard(t.styleLine, `Album track ${t.index} style copied`)}
                  className="mt-1 rounded-lg border border-fuchsia-300/30 px-2 py-1 text-[10px] font-bold text-fuchsia-50"
                >
                  Copy style
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-amber-400/25 bg-amber-950/20 p-3">
          <div className="text-xs font-bold uppercase tracking-wider text-amber-200/90">Custom Model pack</div>
          <ul className="mt-2 space-y-1 text-[11px] text-amber-50/85">
            {customPack.checklist.map((c) => (
              <li key={c.label}>
                {c.ok ? "✓" : "○"} {c.label}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[10px] text-white/50">{customPack.uploadTip}</p>
          <button
            type="button"
            onClick={() => {
              copyToClipboard(customPack.soundBible, "Custom Model sound bible copied");
              setStatusWithTime("Sound bible copied for Suno Custom Model upload");
            }}
            className="mt-2 rounded-xl bg-amber-300 px-3 py-1.5 text-[11px] font-bold text-black"
          >
            Copy sound bible
          </button>
        </section>

        {sunoFieldSlices?.style ? (
          <section className="rounded-2xl border border-cyan-400/20 bg-cyan-950/15 p-3">
            <div className="text-xs font-bold uppercase tracking-wider text-cyan-200/80">Current style critic</div>
            <p className="mt-1 text-[10px] text-white/45">
              Open Pro Mode for full 0–100 prompt score on the live Style + Lyrics fields.
            </p>
          </section>
        ) : null}
      </div>
    </Panel>
  );
});
