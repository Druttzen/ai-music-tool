"use client";

import { memo, useMemo, useState } from "react";
import {
  useProjectWorkspaceActions,
  useProjectWorkspaceAnalyzerState,
  useProjectWorkspaceProjectState,
  useProjectWorkspacePromptState,
} from "../context/project-workspace-context";
import {
  buildVocalEmbedExport,
  buildVocalEmbedPlan,
  formatVocalEmbedTime,
} from "../lib/vocal-embed-engine";
import { Panel } from "./ui-blocks";

export const CenterVocalEmbedStudio = memo(function CenterVocalEmbedStudio() {
  const {
    generatedLyrics,
    lyricStructure,
    lyricTheme,
    selectedGenres,
    tempo,
    vocal,
    voiceStyleLine,
  } = useProjectWorkspaceProjectState();
  const { audioAnalysis } = useProjectWorkspaceAnalyzerState();
  const { voiceStyleCompact } = useProjectWorkspacePromptState();
  const { copyToClipboard, setStatusWithTime } = useProjectWorkspaceActions();
  const [draftLyrics, setDraftLyrics] = useState("");
  const [guideVocalAttached, setGuideVocalAttached] = useState(false);

  const plan = useMemo(
    () =>
      buildVocalEmbedPlan({
        audioAnalysis,
        generatedLyrics,
        guideVocalAttached,
        lyricStructure,
        lyricTheme,
        selectedGenres,
        tempo,
        vocal,
        vocalEmbedLyrics: draftLyrics,
        voiceStyleCompact,
        voiceStyleLine,
      }),
    [
      audioAnalysis,
      draftLyrics,
      generatedLyrics,
      guideVocalAttached,
      lyricStructure,
      lyricTheme,
      selectedGenres,
      tempo,
      vocal,
      voiceStyleCompact,
      voiceStyleLine,
    ],
  );

  const exportPlan = () => {
    const payload = buildVocalEmbedExport(plan);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vocal-embed-plan.json";
    a.click();
    URL.revokeObjectURL(url);
    setStatusWithTime("Vocal embed plan exported");
  };

  return (
    <Panel
      title="Vocal Embed Studio"
      hint="Local path for adding vocals to your existing instrumental. This does not depend on Suno's generation engine."
    >
      <div
        className={`mb-3 rounded-2xl border px-3 py-2 text-xs ${
          plan.stage === "ready"
            ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-50"
            : "border-amber-400/35 bg-amber-500/10 text-amber-50"
        }`}
      >
        {plan.stage === "ready"
          ? "Ready to hand off to a local vocal synthesis/conversion sidecar."
          : "Draft mode: add the missing pieces below before synthesis/conversion."}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-white/40">Instrumental</div>
          <div className="mt-1 text-sm font-bold text-cyan-100">
            {audioAnalysis?.fileName || "No analyzed track"}
          </div>
          <div className="mt-1 text-[11px] text-white/45">
            {plan.duration ? formatVocalEmbedTime(plan.duration) : "Drop/analyze a track"} · {plan.bpm} · {plan.key}
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-white/40">Voice style</div>
          <div className="mt-1 text-sm font-bold text-fuchsia-100">{plan.voiceStyle}</div>
          <div className="mt-1 text-[11px] text-white/45">
            {plan.hasVoiceStyle ? "Voice Character traits loaded" : "Analyze/load a character voice first"}
          </div>
        </div>
        <label className="rounded-2xl border border-white/10 bg-black/30 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-white/40">Guide vocal</div>
          <div className="mt-2 flex items-center gap-2 text-xs text-white/70">
            <input
              type="checkbox"
              checked={guideVocalAttached}
              onChange={(e) => setGuideVocalAttached(e.target.checked)}
            />
            User will provide guide vocal timing
          </div>
          <div className="mt-1 text-[11px] text-white/45">
            Best results: guide vocal or MIDI. No guide means experimental lyrics-to-vocal synthesis.
          </div>
        </label>
      </div>

      <label className="mt-3 block">
        <div className="mb-1 text-xs font-bold uppercase tracking-wider text-white/45">
          Lyrics for local vocal
        </div>
        <textarea
          value={draftLyrics}
          onChange={(e) => setDraftLyrics(e.target.value)}
          placeholder={generatedLyrics ? "Leave blank to use generated lyrics, or paste replacement lyrics here." : "Paste lyrics here."}
          rows={6}
          className="w-full resize-y rounded-2xl border border-white/10 bg-black/30 p-3 text-sm text-white outline-none focus:border-fuchsia-300"
        />
        {generatedLyrics && !draftLyrics.trim() ? (
          <p className="mt-1 text-[10px] text-white/40">Using generated lyrics from Co-Producer.</p>
        ) : null}
      </label>

      {plan.warnings.length ? (
        <div className="mt-3 rounded-2xl border border-amber-400/25 bg-amber-500/10 p-3">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-amber-100/80">
            Missing / risk
          </div>
          <ul className="list-disc space-y-1 pl-4 text-[11px] text-amber-50/90">
            {plan.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-3 rounded-2xl border border-cyan-400/20 bg-black/30 p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-100/80">
            Vocal placement map
          </div>
          <div className="font-mono text-[10px] text-white/40">{plan.sections.length} sections</div>
        </div>
        <div className="space-y-2">
          {plan.sections.map((section, index) => (
            <div key={`${section.name}-${index}`} className="rounded-xl bg-white/[0.04] px-3 py-2">
              <div className="flex flex-wrap justify-between gap-2 text-xs">
                <span className="font-bold text-cyan-100">{section.name}</span>
                <span className="font-mono text-white/45">
                  {formatVocalEmbedTime(section.start)}-{formatVocalEmbedTime(section.end)}
                </span>
              </div>
              <div className="mt-1 text-[10px] text-white/40">{section.lineCount} singable lines</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-white/10 bg-black/40 p-3">
        <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-white/45">
          Sidecar synthesis / mix brief
        </div>
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed text-white/70">
          {plan.sidecarBrief}
        </pre>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <button
          type="button"
          onClick={() => copyToClipboard(plan.sidecarBrief, "Vocal embed brief copied")}
          className="rounded-2xl bg-fuchsia-300 px-4 py-2 text-sm font-bold text-black hover:bg-fuchsia-200"
        >
          Copy local vocal brief
        </button>
        <button
          type="button"
          onClick={exportPlan}
          className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/20"
        >
          Export vocal embed plan JSON
        </button>
      </div>
    </Panel>
  );
});
