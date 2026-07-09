"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useProjectWorkspaceActions,
  useProjectWorkspaceAnalyzerState,
  useProjectWorkspaceProjectState,
  useProjectWorkspacePromptState,
} from "../context/project-workspace-context";
import { resolveAudioCacheBlob } from "../lib/audio-cache";
import { SUPPORTED_AUDIO_ACCEPT, isSupportedAudioFile } from "../lib/analyzer-file-types";
import {
  buildVocalEmbedExport,
  buildVocalEmbedPlan,
  formatVocalEmbedTime,
} from "../lib/vocal-embed-engine";
import {
  fetchSidecarHealth,
  fetchVocalEmbedModels,
  submitVocalEmbedPlanToSidecar,
  synthesizeVocalEmbedViaSidecar,
  waitForSidecar,
} from "../lib/sidecar-bridge";
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
  const { audioAnalysis, audioPreviewUrl } = useProjectWorkspaceAnalyzerState();
  const { voiceStyleCompact } = useProjectWorkspacePromptState();
  const { copyToClipboard, setStatusWithTime } = useProjectWorkspaceActions();
  const [draftLyrics, setDraftLyrics] = useState("");
  const [guideVocalAttached, setGuideVocalAttached] = useState(false);
  const [guideVocalFile, setGuideVocalFile] = useState(null);
  const [sidecarBusy, setSidecarBusy] = useState(false);
  const [sidecarHealth, setSidecarHealth] = useState(null);
  const [vocalModels, setVocalModels] = useState(null);
  const guideInputRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [health, models] = await Promise.all([fetchSidecarHealth(), fetchVocalEmbedModels()]);
      if (!cancelled) {
        setSidecarHealth(health);
        setVocalModels(models);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sidecarBusy]);

  const plan = useMemo(
    () =>
      buildVocalEmbedPlan({
        audioAnalysis,
        generatedLyrics,
        guideVocalAttached: guideVocalAttached || !!guideVocalFile,
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
      guideVocalFile,
      lyricStructure,
      lyricTheme,
      selectedGenres,
      tempo,
      vocal,
      voiceStyleCompact,
      voiceStyleLine,
    ],
  );

  const canLyricsOnlySynth =
    plan.sidecarMode === "lyrics-to-vocal-synthesis" &&
    (!!sidecarHealth?.vocal_ml_available || !!vocalModels?.diffsinger_configured);
  const canSynthesize = plan.stage === "ready" && (!!guideVocalFile || canLyricsOnlySynth);

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

  const resolveInstrumentalBlob = useCallback(async () => {
    const resolved = await resolveAudioCacheBlob(audioAnalysis);
    if (resolved?.blob) return resolved.blob;
    if (audioPreviewUrl) {
      const res = await fetch(audioPreviewUrl);
      return res.blob();
    }
    return null;
  }, [audioAnalysis, audioPreviewUrl]);

  const submitToSidecar = useCallback(async () => {
    if (plan.stage !== "ready") {
      setStatusWithTime("Complete the plan first (instrumental, lyrics, voice style)", "warning");
      return;
    }
    setSidecarBusy(true);
    try {
      const ready = await waitForSidecar(15_000);
      if (!ready) {
        setStatusWithTime("Start the librosa sidecar (npm run sidecar) first", "warning");
        return;
      }
      const payload = buildVocalEmbedExport(plan);
      const res = await submitVocalEmbedPlanToSidecar(payload);
      setStatusWithTime(res.message, res.synthesis_available ? "success" : "info");
    } catch (err) {
      setStatusWithTime(err instanceof Error ? err.message : "Sidecar handoff failed", "error");
    } finally {
      setSidecarBusy(false);
    }
  }, [plan, setStatusWithTime]);

  const synthesizePreview = useCallback(async () => {
    if (plan.stage !== "ready") {
      setStatusWithTime("Complete the plan first (instrumental, lyrics, voice style)", "warning");
      return;
    }
    if (!guideVocalFile && !canLyricsOnlySynth) {
      setStatusWithTime(
        guideVocalAttached
          ? "Choose a guide vocal file below, or install sidecar vocal DSP for lyrics-only synthesis"
          : "Attach a guide vocal file, or enable lyrics-only mode with pip install -e ai-sidecar[vocal]",
        "warning",
      );
      return;
    }

    setSidecarBusy(true);
    try {
      const ready = await waitForSidecar(20_000);
      if (!ready) {
        setStatusWithTime("Start the librosa sidecar (npm run sidecar) first", "warning");
        return;
      }
      const health = await fetchSidecarHealth();
      const models = await fetchVocalEmbedModels();
      setSidecarHealth(health);
      setVocalModels(models);
      const instrumental = await resolveInstrumentalBlob();
      if (!instrumental) {
        setStatusWithTime("Instrumental audio missing from cache — re-analyze the track", "warning");
        return;
      }
      const payload = buildVocalEmbedExport(plan);
      const mixBlob = await synthesizeVocalEmbedViaSidecar(
        payload,
        instrumental,
        audioAnalysis?.fileName || "instrumental.wav",
        guideVocalFile,
        guideVocalFile?.name || "guide-vocal.wav",
      );
      const url = URL.createObjectURL(mixBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vocal-embed-mix-${(audioAnalysis?.fileName || "track").replace(/\.[^.]+$/, "")}.wav`;
      a.click();
      URL.revokeObjectURL(url);
      const engineLabel = guideVocalFile
        ? models?.rvc_ready
          ? "rvc-conversion-v1"
          : health?.vocal_ml_available
            ? "guide-conversion-v1"
            : "placement-mix-v1"
        : models?.diffsinger_configured
          ? "diffsinger-v1"
          : "lyrics-synth-v1";
      setStatusWithTime(`Vocal embed preview downloaded (${engineLabel})`, "success");
    } catch (err) {
      setStatusWithTime(err instanceof Error ? err.message : "Vocal synthesis failed", "error");
    } finally {
      setSidecarBusy(false);
    }
  }, [
    audioAnalysis?.fileName,
    canLyricsOnlySynth,
    guideVocalAttached,
    guideVocalFile,
    plan,
    resolveInstrumentalBlob,
    setStatusWithTime,
  ]);

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
          ? vocalModels?.rvc_ready
            ? "Ready: RVC guide conversion, DiffSinger/DSP lyrics synth, or placement-mix."
            : canLyricsOnlySynth
              ? "Ready: guide conversion, lyrics-only synth (vocal DSP), or placement-mix with a guide file."
              : "Ready for placement-mix. Install vocal DSP or configure RVC/DiffSinger models."
          : "Draft mode: add the missing pieces below before synthesis/conversion."}
      </div>

      {sidecarHealth ? (
        <div className="mb-3 flex flex-wrap gap-2 text-[10px]">
          <span
            className={`rounded-full px-2 py-1 font-bold ${
              sidecarHealth.vocal_synthesis_available
                ? "bg-emerald-500/15 text-emerald-100"
                : "bg-white/10 text-white/45"
            }`}
          >
            placement-mix {sidecarHealth.vocal_synthesis_available ? "on" : "off"}
          </span>
          <span
            className={`rounded-full px-2 py-1 font-bold ${
              sidecarHealth.vocal_ml_available
                ? "bg-fuchsia-500/15 text-fuchsia-100"
                : "bg-white/10 text-white/45"
            }`}
          >
            vocal DSP {sidecarHealth.vocal_ml_available ? "on" : "off"}
          </span>
          <span
            className={`rounded-full px-2 py-1 font-bold ${
              vocalModels?.rvc_ready
                ? "bg-violet-500/15 text-violet-100"
                : "bg-white/10 text-white/45"
            }`}
          >
            RVC {vocalModels?.rvc_ready ? "on" : "off"}
          </span>
          <span
            className={`rounded-full px-2 py-1 font-bold ${
              vocalModels?.diffsinger_configured
                ? "bg-sky-500/15 text-sky-100"
                : "bg-white/10 text-white/45"
            }`}
          >
            DiffSinger {vocalModels?.diffsinger_configured ? "on" : "off"}
          </span>
        </div>
      ) : null}

      {vocalModels && !vocalModels.models_ready ? (
        <p className="mb-3 text-[10px] leading-relaxed text-white/40">
          For RVC: set <span className="text-white/55">AIMC_RVC_MODEL</span> or run an RVC API on{" "}
          <span className="text-white/55">AIMC_RVC_API_URL</span>. For DiffSinger: set{" "}
          <span className="text-white/55">AIMC_DIFFSINGER_CMD</span> or <span className="text-white/55">AIMC_DIFFSINGER_URL</span>.
          Run <span className="text-white/55">npm run sidecar:vocal-ml</span> for torch DSP fallback.
        </p>
      ) : null}

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
            I will provide guide vocal timing
          </div>
          <div className="mt-2">
            <input
              ref={guideInputRef}
              type="file"
              accept={SUPPORTED_AUDIO_ACCEPT}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (!isSupportedAudioFile(file)) {
                  setStatusWithTime("Guide vocal must be WAV, MP3, OGG, M4A, or FLAC", "warning");
                  e.target.value = "";
                  return;
                }
                setGuideVocalFile(file);
                setGuideVocalAttached(true);
                setStatusWithTime(`Guide vocal attached: ${file.name}`, "info");
              }}
            />
            <button
              type="button"
              onClick={() => guideInputRef.current?.click()}
              className="rounded-xl border border-fuchsia-400/30 bg-fuchsia-500/10 px-3 py-1.5 text-xs font-bold text-fuchsia-100 hover:bg-fuchsia-500/20"
            >
              {guideVocalFile ? "Change guide vocal" : "Attach guide vocal file"}
            </button>
            {guideVocalFile ? (
              <div className="mt-1 truncate text-[10px] text-white/45">{guideVocalFile.name}</div>
            ) : null}
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
        <button
          type="button"
          disabled={sidecarBusy || plan.stage !== "ready"}
          onClick={() => void submitToSidecar()}
          className="rounded-2xl border border-cyan-400/35 bg-cyan-500/15 px-4 py-2 text-sm font-bold text-cyan-100 hover:bg-cyan-500/25 disabled:opacity-40"
        >
          {sidecarBusy ? "Sidecar busy…" : "Send plan to sidecar"}
        </button>
        <button
          type="button"
          disabled={sidecarBusy || !canSynthesize}
          onClick={() => void synthesizePreview()}
          className="rounded-2xl bg-emerald-300 px-4 py-2 text-sm font-bold text-black hover:bg-emerald-200 disabled:opacity-40"
        >
          {sidecarBusy
            ? "Synthesizing…"
            : canLyricsOnlySynth && !guideVocalFile
              ? "Synthesize lyrics-only preview"
              : "Synthesize placement-mix preview"}
        </button>
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-white/40">
        With <span className="text-white/55">vocal</span> extra: DSP guide conversion or lyrics synth.
        Configure <span className="text-white/55">AIMC_RVC_MODEL</span> / <span className="text-white/55">AIMC_DIFFSINGER_CMD</span> for full model stacks (user-owned voices only).
      </p>
    </Panel>
  );
});
