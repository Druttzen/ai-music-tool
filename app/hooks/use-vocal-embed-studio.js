"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useProjectWorkspaceActions,
  useProjectWorkspaceAnalyzerState,
  useProjectWorkspaceProjectState,
  useProjectWorkspacePromptState,
} from "../context/project-workspace-context";
import { resolveAudioCacheBlob } from "../lib/audio-cache";
import { isSupportedAudioFile } from "../lib/analyzer-file-types";
import {
  buildVocalEmbedExportEnvelope,
  buildVocalEmbedPlan,
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
import { PROJECT_WORKSPACE_RESET_EVENT } from "../lib/project-workspace-reset";
import {
  buildAlignPreviewPersistence,
  computeVocalEmbedCapabilities,
  hydrateAlignFromStoredSession,
  resolveVocalEmbedEngineLabel,
  shouldClearAlignOnGuideChange,
  shouldClearAlignOnInstrumentalChange,
  shouldClearAlignOnLyricsChange,
  vocalEmbedSynthesizeButtonLabel,
} from "../lib/vocal-embed-studio-utils";

export function useVocalEmbedStudio() {
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
    const hydrated = hydrateAlignFromStoredSession(stored, audioAnalysis?.fileName);
    if (hydrated) {
      queueMicrotask(() => {
        setAlignPreview(hydrated.alignPreview);
        setStoredOpenvpiDs(hydrated.storedOpenvpiDs);
      });
    }
  }, [audioAnalysis?.fileName]);

  useEffect(() => {
    const onWorkspaceReset = () => {
      setAlignPreview(null);
      setStoredOpenvpiDs(null);
      setDraftLyrics("");
      setGuideVocalAttached(false);
      setGuideVocalFile(null);
      setGuideForLyricTiming(true);
      if (guideInputRef.current) guideInputRef.current.value = "";
    };
    window.addEventListener(PROJECT_WORKSPACE_RESET_EVENT, onWorkspaceReset);
    return () => window.removeEventListener(PROJECT_WORKSPACE_RESET_EVENT, onWorkspaceReset);
  }, []);

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
      const next = buildAlignPreviewPersistence({
        plan,
        preview,
        instrumentalName: audioAnalysis?.fileName || "",
        guideName: guideVocalFile?.name || "",
        buildOpenvpiDs: buildOpenvpiDsExport,
      });
      setAlignPreview(next.alignPreview);
      setStoredOpenvpiDs(next.storedOpenvpiDs);
      if (!next.storage) {
        writeStoredVocalAlignPreview(null);
        return;
      }
      writeStoredVocalAlignPreview(next.storage);
    },
    [audioAnalysis?.fileName, guideVocalFile?.name, plan],
  );

  useEffect(() => {
    if (shouldClearAlignOnInstrumentalChange(instrumentalRef.current, audioAnalysis?.fileName)) {
      persistAlignPreview(null);
    }
    instrumentalRef.current = audioAnalysis?.fileName;
  }, [audioAnalysis?.fileName, persistAlignPreview]);

  useEffect(() => {
    if (shouldClearAlignOnGuideChange(guideVocalRef.current, guideVocalFile)) {
      persistAlignPreview(null);
    }
    guideVocalRef.current = guideVocalFile;
  }, [guideVocalFile, persistAlignPreview]);

  useEffect(() => {
    if (shouldClearAlignOnLyricsChange(lyricsRef.current, generatedLyrics, alignPreview)) {
      persistAlignPreview(null);
    }
    lyricsRef.current = generatedLyrics;
  }, [alignPreview, generatedLyrics, persistAlignPreview]);

  useEffect(() => {
    if (!alignPreview || plan.stage !== "ready") return;
    const ds = buildOpenvpiDsExport(plan, alignPreview);
    if (!ds.segments?.length) return;
    queueMicrotask(() => {
      setStoredOpenvpiDs(ds);
      const stored = readStoredVocalAlignPreview();
      if (
        stored?.preview &&
        stored.instrumentalName === audioAnalysis?.fileName
      ) {
        writeStoredVocalAlignPreview({ ...stored, openvpiDs: ds });
      }
    });
  }, [alignPreview, audioAnalysis?.fileName, plan]);

  const capabilities = useMemo(
    () =>
      computeVocalEmbedCapabilities({
        plan,
        sidecarHealth,
        vocalModels,
        alignPreview,
        guideVocalAttached,
        guideVocalFile,
      }),
    [alignPreview, guideVocalAttached, guideVocalFile, plan, sidecarHealth, vocalModels],
  );
  const { canLyricsOnlySynth, hasStoredAlign, canSynthesize, openvpiInferenceReady } = capabilities;

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
      `OpenVPI .ds JSON downloaded (${payload.segment_count} segments${payload.align_method ? ` Â· ${payload.align_method}` : ""})`,
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
        `Handoff pack downloaded (${preview.align_method} align Â· ${preview.word_count} words${openvpiDs.segments?.length ? " Â· OpenVPI .ds" : ""})`,
        "success",
      );
    } catch (err) {
      setStatusWithTime(err instanceof Error ? err.message : "Align & handoff export failed", "error");
    } finally {
      setSidecarBusy(false);
    }
  }, [audioAnalysis, buildSidecarEnvelope, guideVocalFile, persistAlignPreview, plan, resolveInstrumentalBlob, setStatusWithTime]);

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
        `Alignment preview: ${preview.align_method} Â· ${preview.word_count} words`,
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
      const payload = buildVocalEmbedExportEnvelope(
        plan,
        alignOverride || alignPreview,
        (() => {
          const ds =
            storedOpenvpiDs ||
            buildOpenvpiDsExport(plan, alignOverride || alignPreview);
          return ds.segments?.length ? ds : null;
        })(),
      );
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
      const engineLabel = resolveVocalEmbedEngineLabel({
        responseEngine,
        guideVocalFile,
        plan,
        sidecarHealth: health,
        vocalModels: models,
      });
      const timingNote =
        plan.guideForLyricTiming && guideVocalFile ? " Â· guide timing on" : "";
      setStatusWithTime(
        `Vocal embed preview downloaded (${engineLabel}${timingNote}${alignNote})`,
        "success",
      );
    },
    [alignPreview, audioAnalysis?.fileName, guideVocalFile, plan, resolveInstrumentalBlob, setStatusWithTime, storedOpenvpiDs],
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
      await runSynthesizeMix(` Â· ${preview.align_method} align`, preview);
    } catch (err) {
      setStatusWithTime(err instanceof Error ? err.message : "Align & synthesize failed", "error");
    } finally {
      setSidecarBusy(false);
    }
  }, [buildSidecarEnvelope, guideVocalFile, persistAlignPreview, plan, runSynthesizeMix, setStatusWithTime]);

  const synthesizeOpenvpiPreview = useCallback(async () => {
    if (!openvpiInferenceReady) {
      setStatusWithTime("OpenVPI DiffSinger checkpoints are not ready yet", "warning");
      return;
    }
    if (!guideVocalFile && !canLyricsOnlySynth && !hasStoredAlign) {
      setStatusWithTime("Attach a guide vocal or store alignment for OpenVPI lyric timing", "warning");
      return;
    }
    setSidecarBusy(true);
    try {
      const ready = await waitForSidecar(20_000);
      if (!ready) {
        setStatusWithTime("Start the librosa sidecar (npm run sidecar) first", "warning");
        return;
      }
      await runSynthesizeMix(
        storedOpenvpiDs?.segment_count
          ? ` Â· OpenVPI inference (${storedOpenvpiDs.segment_count} ds segments)`
          : " Â· OpenVPI DiffSinger inference",
      );
    } catch (err) {
      setStatusWithTime(err instanceof Error ? err.message : "OpenVPI synthesis failed", "error");
    } finally {
      setSidecarBusy(false);
    }
  }, [
    canLyricsOnlySynth,
    guideVocalFile,
    hasStoredAlign,
    openvpiInferenceReady,
    runSynthesizeMix,
    setStatusWithTime,
    storedOpenvpiDs,
  ]);

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

  const handleGuideVocalFileChange = useCallback(
    (file) => {
      if (!file) return false;
      if (!isSupportedAudioFile(file)) {
        setStatusWithTime("Guide vocal must be WAV, MP3, OGG, M4A, or FLAC", "warning");
        return false;
      }
      setGuideVocalFile(file);
      setGuideVocalAttached(true);
      setStatusWithTime(`Guide vocal attached: ${file.name}`, "info");
      return true;
    },
    [setStatusWithTime],
  );

  const synthesizeButtonLabel = vocalEmbedSynthesizeButtonLabel({
    plan,
    canLyricsOnlySynth,
    hasStoredAlign,
    guideVocalFile,
    sidecarBusy,
  });

  return {
    generatedLyrics,
    audioAnalysis,
    plan,
    draftLyrics,
    setDraftLyrics,
    guideVocalAttached,
    setGuideVocalAttached,
    guideVocalFile,
    guideForLyricTiming,
    setGuideForLyricTiming,
    sidecarBusy,
    sidecarHealth,
    vocalModels,
    alignPreview,
    storedOpenvpiDs,
    guideInputRef,
    canLyricsOnlySynth,
    hasStoredAlign,
    canSynthesize,
    openvpiInferenceReady,
    exportPlan,
    exportAlignJson,
    exportOpenvpiDs,
    exportHandoffPack,
    alignAndExportHandoffPack,
    previewAlignment,
    submitToSidecar,
    alignAndSynthesizePreview,
    synthesizeOpenvpiPreview,
    synthesizePreview,
    synthesizeButtonLabel,
    handleGuideVocalFileChange,
    copyToClipboard,
  };
}
