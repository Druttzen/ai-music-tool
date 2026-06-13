"use client";

import { memo, useMemo } from "react";
import { Panel } from "./ui-blocks";
import { useProjectWorkspace } from "../context/project-workspace-context";
import { buildSunoPasteDiff, hasSunoPasteContent } from "../lib/suno-reimport";

export const CenterSunoReimportPanel = memo(function CenterSunoReimportPanel() {
  const ws = useProjectWorkspace();

  const diffSections = useMemo(
    () =>
      buildSunoPasteDiff({
        projectStyle: ws.sunoBuiltFieldSlices?.style || "",
        projectLyrics: ws.sunoBuiltFieldSlices?.lyrics || "",
        pastedStyle: ws.sunoPasteStyle,
        pastedLyrics: ws.sunoPasteLyrics,
      }),
    [ws.sunoBuiltFieldSlices, ws.sunoPasteLyrics, ws.sunoPasteStyle],
  );

  const hasPaste = hasSunoPasteContent({
    pastedStyle: ws.sunoPasteStyle,
    pastedLyrics: ws.sunoPasteLyrics,
  });

  return (
    <Panel
      title="Suno Re-import"
      hint="Paste finished Suno Style/Lyrics, compare to your project-built paste, then apply or use for copy."
      data-testid="suno-reimport-panel"
    >
      <p className="mb-3 text-[11px] leading-relaxed text-white/50">
        After a Suno generation pass, paste the Style and Lyrics fields back here. Compare shows what
        changed vs this project. <strong className="text-white/65">Use pasted for copy</strong> swaps
        the Prompt Preview boxes without rewriting your project fields.
      </p>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-white/45">
            Pasted Style
          </span>
          <textarea
            data-testid="suno-reimport-style"
            value={ws.sunoPasteStyle}
            onChange={(e) => ws.setSunoPasteStyle(e.target.value)}
            rows={5}
            placeholder="Paste Suno Style field (comma-separated)…"
            className="w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-sm text-white outline-none focus:border-cyan-300/40"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-white/45">
            Pasted Lyrics
          </span>
          <textarea
            data-testid="suno-reimport-lyrics"
            value={ws.sunoPasteLyrics}
            onChange={(e) => ws.setSunoPasteLyrics(e.target.value)}
            rows={5}
            placeholder="Paste Suno Lyrics field (bracketed direction + text)…"
            className="w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-sm text-white outline-none focus:border-cyan-300/40"
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={ws.captureSunoPasteFromProject}
          className="rounded-2xl border border-white/15 bg-black/30 px-4 py-2 text-sm font-bold text-white hover:bg-white/10"
        >
          Capture from project
        </button>
        <button
          type="button"
          onClick={ws.clearSunoPaste}
          className="rounded-2xl border border-white/15 bg-black/30 px-4 py-2 text-sm font-bold text-white/80 hover:bg-white/10"
        >
          Clear paste
        </button>
        {ws.sunoPasteActive ? (
          <button
            type="button"
            onClick={ws.deactivateSunoPasteForCopy}
            className="rounded-2xl bg-amber-300 px-4 py-2 text-sm font-bold text-black hover:bg-amber-200"
          >
            Stop using pasted for copy
          </button>
        ) : (
          <button
            type="button"
            data-testid="suno-reimport-use-for-copy"
            onClick={ws.activateSunoPasteForCopy}
            disabled={!hasPaste}
            className="rounded-2xl bg-cyan-300 px-4 py-2 text-sm font-bold text-black hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Use pasted for copy
          </button>
        )}
        <button
          type="button"
          data-testid="suno-reimport-apply-lyrics"
          onClick={ws.applyPastedLyricsToGenerated}
          disabled={!ws.sunoPasteLyrics?.trim()}
          className="rounded-2xl bg-emerald-300 px-4 py-2 text-sm font-bold text-black hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Apply pasted Lyrics to project
        </button>
      </div>

      {ws.sunoPasteActive && (
        <p className="mt-3 rounded-2xl border border-cyan-300/30 bg-cyan-300/10 px-3 py-2 text-xs font-bold text-cyan-100">
          Prompt Preview and Copy Prompt use pasted Suno fields.
        </p>
      )}

      {diffSections.length > 0 && (
        <div className="mt-4 space-y-3" data-testid="suno-reimport-diff">
          {diffSections.map((section) => (
            <div
              key={section.id}
              className={
                "rounded-2xl border p-3 " +
                (section.changed
                  ? "border-amber-400/30 bg-amber-500/10"
                  : "border-white/10 bg-black/20")
              }
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-white/60">
                  {section.label}
                </span>
                <span
                  className={
                    "text-[11px] font-bold " +
                    (section.changed ? "text-amber-200" : "text-emerald-200")
                  }
                  data-testid={`suno-reimport-diff-${section.id}`}
                >
                  {section.summary}
                </span>
              </div>
              {section.changed && section.pasted && (
                <details className="text-xs text-white/70">
                  <summary className="cursor-pointer font-bold text-white/55">Show diff detail</summary>
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    <div>
                      <div className="mb-1 font-bold text-white/45">Project-built</div>
                      <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-xl bg-black/40 p-2 text-[11px]">
                        {section.project || "—"}
                      </pre>
                    </div>
                    <div>
                      <div className="mb-1 font-bold text-white/45">Pasted</div>
                      <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-xl bg-black/40 p-2 text-[11px]">
                        {section.pasted}
                      </pre>
                    </div>
                  </div>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
});
