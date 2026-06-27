"use client";

import dynamic from "next/dynamic";
import { memo } from "react";
import { Panel } from "./ui-blocks";
import {
  SUNO_LIMITS_NOTE,
  SUNO_LYRICS_CHAR_TYPICAL_MAX,
  SUNO_STYLE_CHAR_CAP,
} from "../lib/suno-limits";
import {
  useProjectWorkspaceActions,
  useProjectWorkspaceProjectState,
  useProjectWorkspacePromptState,
} from "../context/project-workspace-context";

const SunoLanguageIndexPanel = dynamic(
  () =>
    import("./suno-language-index-panel").then((mod) => ({
      default: mod.SunoLanguageIndexPanel,
    })),
  {
    ssr: false,
    loading: () => (
      <Panel title="Suno Language Index" hint="Loading reference…">
        <p className="text-xs text-white/45">Loading vocabulary index…</p>
      </Panel>
    ),
  },
);

export const PageSidebarRight = memo(function PageSidebarRight() {
  const { copied, history, promptEngine, scores, selectedHistoryId } =
    useProjectWorkspaceProjectState();
  const { prompt, sunoSlices, sunoWarnings } = useProjectWorkspacePromptState();
  const {
    addHistory,
    applyGenreAnchors,
    clearHistory,
    copyPrompt,
    copyToClipboard,
    fixSunoWarnings,
    restoreHistory,
    setScores,
  } = useProjectWorkspaceActions();

  return (
    <aside className="space-y-4">
      <Panel title="Prompt Preview" hint="Paste-ready Style and Lyrics — no internal labels or tips.">
        {sunoSlices ? (
          <div className="space-y-3">
            <div>
              <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-cyan-200/80">
                Style
              </div>
              <pre
                data-testid="prompt-preview-style"
                className="max-h-[220px] overflow-auto whitespace-pre-wrap rounded-2xl border border-cyan-300/20 bg-black/50 p-4 text-xs leading-relaxed text-cyan-50"
              >
                {sunoSlices.style || ""}
              </pre>
            </div>
            <div>
              <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-fuchsia-200/80">
                Lyrics
              </div>
              <pre
                data-testid="prompt-preview-lyrics"
                className="max-h-[220px] overflow-auto whitespace-pre-wrap rounded-2xl border border-fuchsia-300/20 bg-black/50 p-4 text-xs leading-relaxed text-fuchsia-50"
              >
                {sunoSlices.lyrics || ""}
              </pre>
            </div>
          </div>
        ) : (
          <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-2xl border border-cyan-300/20 bg-black/50 p-4 text-xs leading-relaxed text-cyan-50">
            {prompt}
          </pre>
        )}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={copyPrompt} className="rounded-2xl bg-cyan-300 px-4 py-2 font-bold text-black hover:bg-cyan-200">
            {copied ? "Copied!" : "Copy Prompt"}
          </button>
          <button
            onClick={() => addHistory("Manual snapshot")}
            className="rounded-2xl bg-white px-4 py-2 font-bold text-black hover:bg-cyan-100"
          >
            Save Snapshot
          </button>
        </div>
        {sunoSlices ? (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => copyToClipboard(sunoSlices.style, "Suno Style box copied")}
              className="rounded-2xl border border-cyan-400/35 bg-cyan-500/15 px-4 py-2 text-xs font-bold text-cyan-100 hover:bg-cyan-500/25"
            >
              Copy Style box
            </button>
            <button
              type="button"
              onClick={() => copyToClipboard(sunoSlices.lyrics, "Suno Lyrics field copied")}
              className="rounded-2xl border border-fuchsia-400/35 bg-fuchsia-500/15 px-4 py-2 text-xs font-bold text-fuchsia-100 hover:bg-fuchsia-500/25"
            >
              Copy Lyrics field
            </button>
          </div>
        ) : null}
      </Panel>
      {promptEngine === "Suno-like" && (
        <Panel title="Suno-like Validator" hint="Checks structured style/prompt constraints before copying.">
          {sunoSlices ? (
            <div className="mb-3 rounded-2xl border border-white/10 bg-black/35 p-3 text-[10px] leading-relaxed text-white/55">
              <div className="font-bold text-cyan-100/90">Suno field lengths (paste-ready)</div>
              <div className="mt-1 font-mono text-white/75">
                Style: {sunoSlices.style.length} / {SUNO_STYLE_CHAR_CAP} (cap) · Lyrics:{" "}
                {sunoSlices.lyrics.length} / ~{SUNO_LYRICS_CHAR_TYPICAL_MAX}
              </div>
              <p className="mt-2 text-white/45">{SUNO_LIMITS_NOTE}</p>
            </div>
          ) : null}
          {sunoWarnings.length > 0 && (
            <button
              onClick={fixSunoWarnings}
              className="mb-3 w-full rounded-2xl bg-emerald-300 px-4 py-2 text-sm font-bold text-black hover:bg-emerald-200"
            >
              Fix Suno Warnings
            </button>
          )}
          {sunoWarnings.length ? (
            <div className="space-y-2">
              {sunoWarnings.map((w, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-3 text-xs text-amber-50"
                >
                  {w}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-3 text-xs text-emerald-100">
              Prompt structure looks solid for Suno-like generation.
            </div>
          )}
        </Panel>
      )}
      <SunoLanguageIndexPanel copyToClipboard={copyToClipboard} onApplyGenreAnchors={applyGenreAnchors} />
      <Panel title="History / Compare" hint="Restore earlier prompt states.">
        <button
          onClick={clearHistory}
          className="mb-3 w-full rounded-2xl border border-red-300/30 bg-red-300/10 px-4 py-2 text-sm font-bold text-red-200 hover:bg-red-300/20"
        >
          Clear History
        </button>
        {history.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/25 p-3 text-xs text-white/45">
            No history yet. Copy a prompt, save a snapshot, or generate variations.
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((h) => (
              <div
                key={h.id}
                className={
                  "rounded-2xl border p-3 " +
                  (selectedHistoryId === h.id
                    ? "border-cyan-300/50 bg-cyan-300/10"
                    : "border-white/10 bg-black/25")
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold text-cyan-100">{h.label}</div>
                    <div className="text-[10px] text-white/40">
                      {h.time} • score {h.avgScore}/5
                    </div>
                  </div>
                  <button
                    onClick={() => restoreHistory(h)}
                    className="rounded-xl bg-white px-2 py-1 text-xs font-bold text-black"
                  >
                    Restore
                  </button>
                </div>
                <pre className="mt-2 max-h-20 overflow-auto whitespace-pre-wrap text-[10px] text-white/45">
                  {h.prompt}
                </pre>
              </div>
            ))}
          </div>
        )}
      </Panel>
      <Panel title="Track Scoring" hint="Use after generation to compare outputs.">
        {Object.entries(scores).map(([key, value]) => (
          <div key={key} className="mb-3 rounded-2xl bg-black/25 p-3">
            <div className="mb-2 flex justify-between text-sm">
              <span className="capitalize text-white/70">{key}</span>
              <span className="font-bold text-cyan-200">{value}/5</span>
            </div>
            <input
              type="range"
              min="1"
              max="5"
              value={value}
              onChange={(e) => setScores({ ...scores, [key]: Number(e.target.value) })}
              className="w-full accent-cyan-300"
            />
          </div>
        ))}
      </Panel>
    </aside>
  );
});
