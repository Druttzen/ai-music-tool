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
  buildVocalEmbedExportEnvelope,
  buildVocalEmbedPlan,
  formatVocalEmbedTime,
} from "../lib/vocal-embed-engine";
import { buildOpenvpiDsExport } from "../lib/openvpi-ds-export";
import {
  exportOpenvpiDsViaSidecar,
  fetchSidecarHealth,
  fetchVocalEmbedModels,
  previewVocalAlignViaSidecar,
  submitVocalEmbedPlanToSidecar,
  synthesizeVocalEmbedViaSidecar,
  waitForSidecar,
} from "../lib/sidecar-bridge";
import {
  exportVocalEmbedHandoffPack,
  readStoredVocalAlignPreview,
  writeStoredVocalAlignPreview,
} from "../lib/vocal-embed-handoff";
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
  const [guideForLyricTiming, setGuideForLyricTiming] = useState(true);
  const [sidecarBusy, setSidecarBusy] = useState(false);
  const [sidecarHealth, setSidecarHealth] = useState(null);
  const [vocalModels, setVocalModels] = useState(null);
  const [alignPreview, setAlignPreview] = useState(null);
  const [storedOpenvpiDs, setStoredOpenvpiDs] = useState(null);
  const guideInputRef = useRef(null);
  const instrumentalRef = useRef(audioAnalysis?.fileName);
  const guideVocalRef = useRef(guideVocalFile);
  const lyricsRef = useRef(generatedLyrics);

  useEffect(() => {
    const stored = readStoredVocalAlignPreview();
    if (
      stored?.preview &&
      stored.instrumentalName &&
      stored.instrumentalName === audioAnalysis?.fileName
    ) {
      setAlignPreview(stored.preview);
      setStoredOpenvpiDs(stored.openvpiDs || null);
    }
  }, [audioAnalysis?.fileName]);

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
        guideVocalFile,
        guideForLyricTiming,
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
      guideForLyricTiming,
      lyricStructure,
      lyricTheme,
      selectedGenres,
      tempo,
      vocal,
      voiceStyleCompact,
      voiceStyleLine,
    ],
  );

  const persistAlignPreview = useCallback(
    (preview) => {
      setAlignPreview(preview);
      if (!preview) {
        setStoredOpenvpiDs(null);
        writeStoredVocalAlignPreview(null);
        return;
      }
      const openvpiDs =
        plan.stage === "ready" ? buildOpenvpiDsExport(plan, preview) : null;
      const dsPayload = openvpiDs?.segments?.length ? openvpiDs : null;
      setStoredOpenvpiDs(dsPayload);
      writeStoredVocalAlignPreview({
        instrumentalName: audioAnalysis?.fileName || "",
        guideName: guideVocalFile?.name || "",
        preview,
        openvpiDs: dsPayload,
      });
    },
    [audioAnalysis?.fileName, guideVocalFile?.name, plan],
  );

  useEffect(() => {
    const prev = instrumentalRef.current;
    const next = audioAnalysis?.fileName;
    if (prev && next && prev !== next) {
      persistAlignPreview(null);
    }
    instrumentalRef.current = next;
  }, [audioAnalysis?.fileName, persistAlignPreview]);

  useEffect(() => {
    const prev = guideVocalRef.current;
    const next = guideVocalFile;
    if (prev && next && prev !== next) {
      persistAlignPreview(null);
    }
    guideVocalRef.current = next;
  }, [guideVocalFile, persistAlignPreview]);

  useEffect(() => {
    const prev = lyricsRef.current;
    const next = generatedLyrics;
    if (prev && next && prev !== next && alignPreview) {
      persistAlignPreview(null);
    }
    lyricsRef.current = next;
  }, [alignPreview, generatedLyrics, persistAlignPreview]);

  useEffect(() => {
    if (!alignPreview || plan.stage !== "ready") return;
    const ds = buildOpenvpiDsExport(plan, alignPreview);
    if (!ds.segments?.length) return;
    setStoredOpenvpiDs(ds);
    const stored = readStoredVocalAlignPreview();
    if (
      stored?.preview &&
      stored.instrumentalName === audioAnalysis?.fileName
    ) {
      writeStoredVocalAlignPreview({ ...stored, openvpiDs: ds });
    }
  }, [alignPreview, audioAnalysis?.fileName, plan]);

  const canLyricsOnlySynth =
    plan.sidecarMode === "lyrics-to-vocal-synthesis" &&
    (!!sidecarHealth?.vocal_ml_available || !!vocalModels?.diffsinger_configured);
  const hasStoredAlign = !!alignPreview?.sections?.some((section) => section?.alignedWords?.length);
  const canSynthesize =
    plan.stage === "ready" && (!!guideVocalFile || canLyricsOnlySynth || hasStoredAlign);

  const buildSidecarEnvelope = useCallback(
    (withAlign = true) => {
      const ds =
        storedOpenvpiDs ||
        (withAlign && alignPreview && plan.stage === "ready"
          ? buildOpenvpiDsExport(plan, alignPreview)
          : null);
      return buildVocalEmbedExportEnvelope(
        plan,
        withAlign ? alignPreview : null,
        ds?.segments?.length ? ds : null,
      );
    },
    [alignPreview, plan, storedOpenvpiDs],
  );

  const exportPlan = () => {
    const payload = buildSidecarEnvelope(true);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vocal-embed-plan.json";
    a.click();
    URL.revokeObjectURL(url);
    setStatusWithTime(
      alignPreview
        ? storedOpenvpiDs?.segment_count
          ? `Vocal embed plan exported (alignment + ${storedOpenvpiDs.segment_count} OpenVPI segments)`
          : "Vocal embed plan exported (includes alignment timing)"
        : "Vocal embed plan exported",
    );
  };

  const exportAlignJson = () => {
    if (!alignPreview) {
      setStatusWithTime("Run alignment preview first", "warning");
      return;
    }
    const blob = new Blob([JSON.stringify(alignPreview, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vocal-embed-align-preview-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusWithTime(`Alignment JSON downloaded (${alignPreview.align_method})`, "success");
  };

  const exportOpenvpiDs = useCallback(async () => {
    if (plan.stage !== "ready") {
      setStatusWithTime("Complete the plan before exporting OpenVPI .ds JSON", "warning");
      return;
    }
    const mergedPlan = buildVocalEmbedExportEnvelope(plan, alignPreview).plan;
    let payload = buildOpenvpiDsExport(mergedPlan, alignPreview);
    if (guideVocalFile) {
      try {
        const ready = await waitForSidecar(10_000);
        if (ready) {
          payload = await exportOpenvpiDsViaSidecar(
            buildSidecarEnvelope(true),
            guideVocalFile,
            guideVocalFile.name,
          );
        }
      } catch {
        /* fall back to client-side DS from stored alignment */
      }
    }
    if (!payload?.segments?.length) {
      setStatusWithTime("No singable sections for OpenVPI .ds export — add lyrics first", "warning");
      return;
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `openvpi-ds-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusWithTime(
      `OpenVPI .ds JSON downloaded (${payload.segment_count} segments${payload.align_method ? ` · ${payload.align_method}` : ""})`,
      "success",
    );
  }, [alignPreview, buildSidecarEnvelope, guideVocalFile, plan, setStatusWithTime]);

  const resolveInstrumentalBlob = useCallback(async () => {
    const resolved = await resolveAudioCacheBlob(audioAnalysis);
    if (resolved?.blob) return resolved.blob;
    if (audioPreviewUrl) {
      const res = await fetch(audioPreviewUrl);
      return res.blob();
    }
    return null;
  }, [audioAnalysis, audioPreviewUrl]);

  const exportHandoffPack = useCallback(async () => {
    if (plan.stage !== "ready") {
      setStatusWithTime("Complete the plan before exporting handoff pack", "warning");
      return;
    }
    const instrumental = await resolveInstrumentalBlob();
    const openvpiDs = buildOpenvpiDsExport(plan, alignPreview);
    await exportVocalEmbedHandoffPack({
      planEnvelope: buildSidecarEnvelope(true),
      instrumental,
      instrumentalName: audioAnalysis?.fileName || "instrumental.wav",
      guideVocal: guideVocalFile,
      guideName: guideVocalFile?.name || "guide-vocal.wav",
      alignPreview,
      openvpiDs: openvpiDs.segments?.length ? openvpiDs : null,
    });
    setStatusWithTime(
      openvpiDs.segments?.length
        ? "Vocal embed handoff pack downloaded (plan + OpenVPI .ds + audio)"
        : "Vocal embed handoff pack downloaded (plan + README + audio files)",
      "success",
    );
  }, [alignPreview, audioAnalysis?.fileName, buildSidecarEnvelope, guideVocalFile, plan, resolveInstrumentalBlob, setStatusWithTime]);

  const alignAndExportHandoffPack = useCallback(async () => {
    if (plan.stage !== "ready") {
      setStatusWithTime("Complete the plan before exporting handoff pack", "warning");
      return;
    }
    if (!guideVocalFile) {
      setStatusWithTime("Attach a guide vocal for align + handoff export", "warning");
      return;
    }
    setSidecarBusy(true);
    try {
      const ready = await waitForSidecar(20_000);
      if (!ready) {
        setStatusWithTime("Start the librosa sidecar (npm run sidecar) first", "warning");
        return;
      }
      const payload = buildSidecarEnvelope(false);
      const preview = await previewVocalAlignViaSidecar(
        payload,
        guideVocalFile,
        guideVocalFile.name,
      );
      persistAlignPreview(preview);
      const instrumental = await resolveInstrumentalBlob();
      const mergedEnvelope = buildVocalEmbedExportEnvelope(plan, preview);
      const openvpiDs = buildOpenvpiDsExport(mergedEnvelope.plan, preview);
      await exportVocalEmbedHandoffPack({
        planEnvelope: mergedEnvelope,
        instrumental,
        instrumentalName: audioAnalysis?.fileName || "instrumental.wav",
        guideVocal: guideVocalFile,
        guideName: guideVocalFile?.name || "guide-vocal.wav",
        alignPreview: preview,
        openvpiDs: openvpiDs.segments?.length ? openvpiDs : null,
      });
      setStatusWithTime(
        `Handoff pack downloaded (${preview.align_method} align · ${preview.word_count} words${openvpiDs.segments?.length ? " · OpenVPI .ds" : ""})`,
        "success",
      );
    } catch (err) {
      setStatusWithTime(err instanceof Error ? err.message : "Align & handoff export failed", "error");
    } finally {
      setSidecarBusy(false);
    }
  }, [audioAnalysis?.fileName, buildSidecarEnvelope, guideVocalFile, persistAlignPreview, plan, resolveInstrumentalBlob, setStatusWithTime]);

  const previewAlignment = useCallback(async () => {
    if (!guideVocalFile) {
      setStatusWithTime("Attach a guide vocal to preview word alignment", "warning");
      return;
    }
    if (plan.stage !== "ready") {
      setStatusWithTime("Complete lyrics and voice style first", "warning");
      return;
    }
    setSidecarBusy(true);
    try {
      const ready = await waitForSidecar(15_000);
      if (!ready) {
        setStatusWithTime("Start the sidecar first", "warning");
        return;
      }
      const payload = buildSidecarEnvelope(false);
      const preview = await previewVocalAlignViaSidecar(
        payload,
        guideVocalFile,
        guideVocalFile.name,
      );
      persistAlignPreview(preview);
      setStatusWithTime(
        `Alignment preview: ${preview.align_method} · ${preview.word_count} words`,
        preview.align_method === "mfa" ? "success" : "info",
      );
    } catch (err) {
      setStatusWithTime(err instanceof Error ? err.message : "Alignment preview failed", "error");
    } finally {
      setSidecarBusy(false);
    }
  }, [buildSidecarEnvelope, guideVocalFile, persistAlignPreview, plan, setStatusWithTime]);

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
      const payload = buildSidecarEnvelope(true);
      const res = await submitVocalEmbedPlanToSidecar(payload);
      setStatusWithTime(res.message, res.synthesis_available ? "success" : "info");
    } catch (err) {
      setStatusWithTime(err instanceof Error ? err.message : "Sidecar handoff failed", "error");
    } finally {
      setSidecarBusy(false);
    }
  }, [buildSidecarEnvelope, plan, setStatusWithTime]);

  const runSynthesizeMix = useCallback(
    async (alignNote = "", alignOverride = null) => {
      const health = await fetchSidecarHealth();
      const models = await fetchVocalEmbedModels();
      setSidecarHealth(health);
      setVocalModels(models);
      const instrumental = await resolveInstrumentalBlob();
      if (!instrumental) {
        setStatusWithTime("Instrumental audio missing from cache — re-analyze the track", "warning");
        return;
      }
      const payload = buildVocalEmbedExportEnvelope(plan, alignOverride || alignPreview);
      const { blob: mixBlob, engine: responseEngine } = await synthesizeVocalEmbedViaSidecar(
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
      const engineLabel =
        responseEngine ||
        (guideVocalFile && plan.sidecarMode === "guide-vocal-conversion"
          ? models?.rvc_ready
            ? "rvc-conversion-v1"
            : health?.vocal_ml_available
              ? "guide-conversion-v1"
              : "placement-mix-v1"
          : models?.diffsinger_openvpi?.ready
            ? "diffsinger-v1"
            : models?.diffsinger_configured
              ? "diffsinger-v1"
              : "lyrics-synth-v1");
      const timingNote =
        plan.guideForLyricTiming && guideVocalFile ? " · guide timing on" : "";
      setStatusWithTime(
        `Vocal embed preview downloaded (${engineLabel}${timingNote}${alignNote})`,
        "success",
      );
    },
    [alignPreview, audioAnalysis?.fileName, guideVocalFile, plan, resolveInstrumentalBlob, setStatusWithTime],
  );

  const alignAndSynthesizePreview = useCallback(async () => {
    if (!guideVocalFile) {
      setStatusWithTime("Attach a guide vocal for align & synthesize", "warning");
      return;
    }
    if (plan.stage !== "ready") {
      setStatusWithTime("Complete the plan first (instrumental, lyrics, voice style)", "warning");
      return;
    }
    setSidecarBusy(true);
    try {
      const ready = await waitForSidecar(20_000);
      if (!ready) {
        setStatusWithTime("Start the librosa sidecar (npm run sidecar) first", "warning");
        return;
      }
      const payload = buildSidecarEnvelope(false);
      const preview = await previewVocalAlignViaSidecar(
        payload,
        guideVocalFile,
        guideVocalFile.name,
      );
      persistAlignPreview(preview);
      await runSynthesizeMix(` · ${preview.align_method} align`, preview);
    } catch (err) {
      setStatusWithTime(err instanceof Error ? err.message : "Align & synthesize failed", "error");
    } finally {
      setSidecarBusy(false);
    }
  }, [buildSidecarEnvelope, guideVocalFile, persistAlignPreview, plan, runSynthesizeMix, setStatusWithTime]);

  const synthesizePreview = useCallback(async () => {
    if (plan.stage !== "ready") {
      setStatusWithTime("Complete the plan first (instrumental, lyrics, voice style)", "warning");
      return;
    }
    if (!guideVocalFile && !canLyricsOnlySynth && !hasStoredAlign) {
      setStatusWithTime(
        guideVocalAttached
          ? "Choose a guide vocal file below, or install sidecar vocal DSP for lyrics-only synthesis"
          : "Attach a guide vocal file, preview alignment, or enable lyrics-only mode with pip install -e ai-sidecar[vocal]",
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
      await runSynthesizeMix();
    } catch (err) {
      setStatusWithTime(err instanceof Error ? err.message : "Vocal synthesis failed", "error");
    } finally {
      setSidecarBusy(false);
    }
  }, [canLyricsOnlySynth, guideVocalAttached, guideVocalFile, hasStoredAlign, plan, runSynthesizeMix, setStatusWithTime]);

  return (
    <Panel
      title="Vocal Embed Studio"
      data-testid="vocal-embed-studio"
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
              vocalModels?.diffsinger_ready ?? vocalModels?.diffsinger_configured
                ? "bg-sky-500/15 text-sky-100"
                : "bg-white/10 text-white/45"
            }`}
          >
            DiffSinger{" "}
            {vocalModels?.diffsinger_openvpi?.ready
              ? "ready"
              : vocalModels?.diffsinger_configured
                ? "on"
                : "off"}
          </span>
          <span
            className={`rounded-full px-2 py-1 font-bold ${
              vocalModels?.diffsinger_openvpi?.ready
                ? "bg-emerald-500/15 text-emerald-100"
                : "bg-white/10 text-white/45"
            }`}
          >
            OpenVPI {vocalModels?.diffsinger_openvpi?.ready ? "ready" : "off"}
          </span>
          <span
            className={`rounded-full px-2 py-1 font-bold ${
              vocalModels?.align?.mfa_configured
                ? "bg-amber-500/15 text-amber-100"
                : "bg-white/10 text-white/45"
            }`}
          >
            MFA {vocalModels?.align?.mfa_configured ? "configured" : "heuristic"}
          </span>
        </div>
      ) : null}

      {alignPreview ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <p className="flex-1 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-[10px] text-amber-100/90">
            Last alignment preview: <strong>{alignPreview.align_method}</strong> — {alignPreview.word_count}{" "}
            aligned words across {alignPreview.sections?.length || 0} sections.
            {storedOpenvpiDs?.segment_count
              ? ` · OpenVPI .ds ready (${storedOpenvpiDs.segment_count} segments)`
              : ""}
            {alignPreview.align_method === "heuristic" ? " Install MFA env vars for tighter timing." : ""}
          </p>
          <button
            type="button"
            onClick={exportAlignJson}
            className="rounded-xl border border-amber-400/35 bg-amber-500/15 px-3 py-2 text-[10px] font-bold text-amber-50 hover:bg-amber-500/25"
          >
            Download align JSON
          </button>
          <button
            type="button"
            data-testid="export-openvpi-ds"
            onClick={() => void exportOpenvpiDs()}
            className="rounded-xl border border-sky-400/35 bg-sky-500/15 px-3 py-2 text-[10px] font-bold text-sky-50 hover:bg-sky-500/25"
          >
            Download OpenVPI .ds JSON
          </button>
        </div>
      ) : null}

      {vocalModels?.diffsinger_openvpi?.configured ? (
        <p className="mb-3 text-[10px] leading-relaxed text-white/40">
          OpenVPI: {vocalModels.diffsinger_openvpi.root || "root set"} · variance{" "}
          {vocalModels.diffsinger_openvpi.variance_exp || "—"} · acoustic{" "}
          {vocalModels.diffsinger_openvpi.acoustic_exp || "—"}.
          Attach a guide vocal with lyrics to refine `.ds` word timing (MFA via{" "}
          <span className="text-white/55">AIMC_MFA_MODEL</span> +{" "}
          <span className="text-white/55">AIMC_MFA_DICT</span>, or librosa onset fallback).
        </p>
      ) : null}

      {vocalModels && !vocalModels.models_ready ? (
        <p className="mb-3 text-[10px] leading-relaxed text-white/40">
          For RVC: set <span className="text-white/55">AIMC_RVC_MODEL</span> or run an RVC API on{" "}
          <span className="text-white/55">AIMC_RVC_API_URL</span>. For DiffSinger: set{" "}
          <span className="text-white/55">AIMC_DIFFSINGER_ROOT</span> + acoustic/variance checkpoints, or{" "}
          <span className="text-white/55">AIMC_DIFFSINGER_CMD</span> / <span className="text-white/55">AIMC_DIFFSINGER_URL</span>.
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
            {guideVocalFile && (draftLyrics.trim() || generatedLyrics) ? (
              <label className="mt-2 flex items-start gap-2 text-[10px] text-white/55">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={guideForLyricTiming}
                  onChange={(e) => setGuideForLyricTiming(e.target.checked)}
                />
                <span>
                  Use guide for lyric timing (DiffSinger/MFA). Uncheck to convert the guide vocal
                  and placement-mix instead.
                </span>
              </label>
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
          <div className="font-mono text-[10px] text-white/40">
            {plan.sections.length} sections · {plan.sidecarMode}
            {plan.guideForLyricTiming ? " · guide timing" : ""}
          </div>
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
              {alignPreview?.sections?.[index]?.alignedWords?.length ? (
                <div className="mt-1 text-[10px] text-amber-100/80">
                  {alignPreview.sections[index].alignedWords
                    .slice(0, 6)
                    .map((w) => w.word)
                    .join(" ")}
                  {alignPreview.sections[index].alignedWords.length > 6 ? "…" : ""}
                </div>
              ) : null}
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
          {alignPreview ? "Export plan JSON (with alignment)" : "Export vocal embed plan JSON"}
        </button>
        <button
          type="button"
          disabled={sidecarBusy || plan.stage !== "ready"}
          onClick={() => void exportHandoffPack()}
          className="rounded-2xl border border-violet-400/35 bg-violet-500/15 px-4 py-2 text-sm font-bold text-violet-100 hover:bg-violet-500/25 disabled:opacity-40"
        >
          Export handoff pack
        </button>
        <button
          type="button"
          disabled={sidecarBusy || !guideVocalFile || plan.stage !== "ready"}
          onClick={() => void alignAndExportHandoffPack()}
          className="rounded-2xl border border-violet-400/45 bg-violet-500/20 px-4 py-2 text-sm font-bold text-violet-50 hover:bg-violet-500/30 disabled:opacity-40"
        >
          {sidecarBusy ? "Working…" : "Align & export handoff"}
        </button>
        <button
          type="button"
          disabled={sidecarBusy || !guideVocalFile || plan.stage !== "ready"}
          onClick={() => void alignAndSynthesizePreview()}
          className="rounded-2xl border border-emerald-400/40 bg-emerald-500/15 px-4 py-2 text-sm font-bold text-emerald-100 hover:bg-emerald-500/25 disabled:opacity-40 md:col-span-2"
        >
          {sidecarBusy ? "Working…" : "Align & synthesize preview"}
        </button>
        <button
          type="button"
          disabled={sidecarBusy || !guideVocalFile || plan.stage !== "ready"}
          onClick={() => void previewAlignment()}
          className="rounded-2xl border border-amber-400/35 bg-amber-500/15 px-4 py-2 text-sm font-bold text-amber-100 hover:bg-amber-500/25 disabled:opacity-40"
        >
          Preview MFA / heuristic alignment
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
          disabled={sidecarBusy || plan.stage !== "ready"}
          data-testid="export-openvpi-ds-plan"
          onClick={() => void exportOpenvpiDs()}
          className="rounded-2xl border border-sky-400/35 bg-sky-500/15 px-4 py-2 text-sm font-bold text-sky-100 hover:bg-sky-500/25 disabled:opacity-40"
        >
          Export OpenVPI .ds JSON
        </button>
        <button
          type="button"
          disabled={sidecarBusy || !canSynthesize}
          onClick={() => void synthesizePreview()}
          className="rounded-2xl bg-emerald-300 px-4 py-2 text-sm font-bold text-black hover:bg-emerald-200 disabled:opacity-40"
        >
          {sidecarBusy
            ? "Synthesizing…"
            : hasStoredAlign && !guideVocalFile
              ? "Synthesize with saved alignment"
              : plan.sidecarMode === "lyrics-to-vocal-synthesis" && guideVocalFile
                ? "Synthesize lyrics + guide timing"
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
