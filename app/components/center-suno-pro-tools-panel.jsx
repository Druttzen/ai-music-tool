"use client";

import { memo, useMemo, useState } from "react";
import { Panel } from "./ui-blocks";
import {
  useProjectWorkspaceActions,
  useProjectWorkspaceProjectState,
  useProjectWorkspacePromptState,
} from "../context/project-workspace-context";
import { buildAlbumSequence, soundBibleFromProject } from "../lib/album-mode";
import { buildCustomModelPack } from "../lib/custom-model-pack";
import { buildMyTasteProfile, trackSummariesFromWorkspace } from "../lib/my-taste-profile";

const DEFAULT_ROLES = [
  { role: "opener", title: "Track 1 — Opener", idea: "" },
  { role: "single", title: "Track 2 — Single", idea: "" },
  { role: "closer", title: "Track 3 — Closer", idea: "" },
];

export const CenterSunoProToolsPanel = memo(function CenterSunoProToolsPanel() {
  const state = useProjectWorkspaceProjectState();
  const { sunoFieldSlices } = useProjectWorkspacePromptState();
  const {
    copyToClipboard,
    setStatusWithTime,
    setSelectedGenres,
    setTempo,
    setVocal,
  } = useProjectWorkspaceActions();

  const [albumRoles, setAlbumRoles] = useState(DEFAULT_ROLES);

  const taste = useMemo(
    () =>
      buildMyTasteProfile({
        current: state,
        history: state.history,
        customPresets: state.customPresets,
      }),
    [state],
  );

  const albumTracks = useMemo(
    () => buildAlbumSequence(soundBibleFromProject(state), albumRoles),
    [state, albumRoles],
  );

  const customPack = useMemo(
    () => buildCustomModelPack(trackSummariesFromWorkspace(state, state.history)),
    [state],
  );

  const updateRole = (index, field, value) => {
    setAlbumRoles((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
  };

  return (
    <Panel
      title="Suno 5.5 Pro tools"
      hint="My Taste, Album cohesion, Custom Model checklist, and multi-engine exports."
      data-testid="suno-pro-tools-panel"
    >
      <div className="space-y-4">
        <section
          className="rounded-2xl border border-violet-400/25 bg-violet-950/20 p-3"
          data-testid="my-taste-profile"
        >
          <div className="text-xs font-bold uppercase tracking-wider text-violet-200/90">My Taste</div>
          <p className="mt-1 text-[11px] text-white/55">
            {taste.sampleCount} project sample(s) · {taste.tip}
          </p>
          {taste.ready ? (
            <>
              <p className="mt-2 text-[10px] text-violet-100/70">
                Top genres: {taste.topGenres.join(", ") || "—"}
                {taste.bpmBand ? ` · ${taste.bpmBand}` : ""}
                {taste.vocalLean ? ` · ${taste.vocalLean}` : ""}
              </p>
              <pre className="mt-2 max-h-20 overflow-auto whitespace-pre-wrap rounded-xl bg-black/40 p-2 text-[10px] text-violet-50">
                {taste.magicStyleLine}
              </pre>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => copyToClipboard(taste.magicStyleLine, "My Taste style copied")}
                  className="rounded-lg border border-violet-300/30 px-2 py-1 text-[10px] font-bold text-violet-50"
                >
                  Copy magic style
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (taste.topGenres.length) {
                      const merged = [
                        ...new Set([...(state.selectedGenres || []), ...taste.topGenres.slice(0, 3)]),
                      ];
                      setSelectedGenres(merged);
                    }
                    if (taste.bpmBand) setTempo(taste.bpmBand);
                    if (taste.vocalLean) setVocal(taste.vocalLean);
                    setStatusWithTime("Merged My Taste genres, tempo, and vocal into project");
                  }}
                  className="rounded-lg bg-violet-300 px-2 py-1 text-[10px] font-bold text-black"
                >
                  Apply to project
                </button>
              </div>
            </>
          ) : (
            <p className="mt-2 text-[10px] text-white/45">
              Copy a few prompts to history or save presets to unlock your local taste line.
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-fuchsia-400/25 bg-fuchsia-950/20 p-3">
          <div className="text-xs font-bold uppercase tracking-wider text-fuchsia-200/90">Album mode</div>
          <p className="mt-1 text-[11px] text-white/55">
            Shared sound bible: {(state.selectedGenres || []).slice(0, 2).join(" + ") || "set genres"} ·{" "}
            {state.tempo || "tempo ?"}
          </p>
          <div className="mt-2 space-y-2">
            {albumRoles.map((role, idx) => (
              <div key={role.role + idx} className="rounded-xl border border-white/10 bg-black/30 p-2">
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="text-[10px] text-white/50">
                    Title
                    <input
                      value={role.title}
                      onChange={(e) => updateRole(idx, "title", e.target.value)}
                      className="mt-0.5 w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-[11px] text-white"
                    />
                  </label>
                  <label className="text-[10px] text-white/50">
                    Idea
                    <input
                      value={role.idea}
                      onChange={(e) => updateRole(idx, "idea", e.target.value)}
                      placeholder="hook, mood, story beat…"
                      className="mt-0.5 w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-[11px] text-white"
                    />
                  </label>
                </div>
                <div className="mt-2 text-[11px] font-bold text-fuchsia-100">
                  {albumTracks[idx]?.index}. {role.title}{" "}
                  <span className="text-white/40">({role.role})</span>
                </div>
                <pre className="mt-1 max-h-16 overflow-auto whitespace-pre-wrap text-[10px] text-white/65">
                  {albumTracks[idx]?.styleLine}
                </pre>
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(albumTracks[idx]?.styleLine || "", `Album track ${idx + 1} style copied`)
                  }
                  className="mt-1 rounded-lg border border-fuchsia-300/30 px-2 py-1 text-[10px] font-bold text-fuchsia-50"
                >
                  Copy style
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              const json = JSON.stringify({ soundBible: soundBibleFromProject(state), tracks: albumTracks }, null, 2);
              copyToClipboard(json, "Album sequence JSON copied");
            }}
            className="mt-2 rounded-xl border border-fuchsia-300/30 px-3 py-1.5 text-[10px] font-bold text-fuchsia-50"
          >
            Copy album JSON
          </button>
        </section>

        <section className="rounded-2xl border border-amber-400/25 bg-amber-950/20 p-3">
          <div className="text-xs font-bold uppercase tracking-wider text-amber-200/90">Custom Model pack</div>
          <p className="mt-1 text-[10px] text-white/45">
            Tracks from current project + history ({customPack.trackCount} unique)
          </p>
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
