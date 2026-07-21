"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Panel } from "./ui-blocks";
import {
  useProjectWorkspaceActions,
  useProjectWorkspaceAnalyzerState,
  useProjectWorkspaceProjectState,
  useProjectWorkspacePromptState,
} from "../context/project-workspace-context";
import { fetchSidecarHealth, generateCoverRefViaSidecar, generateCoverViaSidecar } from "../lib/sidecar-bridge";
import { coverInstallHint, coverRefInstallHint } from "../lib/sidecar-capabilities";
import { buildCoverPromptFromStyle, resolveCoverPromptSource } from "../lib/cover-prompt";
import { buildSunoV55StyleFromAudioAnalysis } from "../lib/audio-to-suno-style";
import { buildSunoV55StyleFromImageAnalysis } from "../lib/image-to-suno-style";
import { useWorkspaceResetEffect } from "../hooks/use-workspace-reset-effect";

/** Opt-in album-cover generation for music releases. */
export const CenterCoverToolsPanel = memo(function CenterCoverToolsPanel() {
  const { idea, sunoPasteStyle } = useProjectWorkspaceProjectState();
  const { sunoFieldSlices } = useProjectWorkspacePromptState();
  const { sidecarAiStatus, audioAnalysis, imageAnalysis, imagePreview } =
    useProjectWorkspaceAnalyzerState();
  const { setStatusWithTime, captureSnapshot } = useProjectWorkspaceActions();

  const [health, setHealth] = useState(null);
  const [busy, setBusy] = useState(false);
  const [strength, setStrength] = useState(0.55);
  const [coverUrl, setCoverUrl] = useState(/** @type {string|null} */ (null));
  const [promptOverride, setPromptOverride] = useState("");
  const operationGenerationRef = useRef(0);
  const operationAbortRef = useRef(null);

  useEffect(() => {
    if (sidecarAiStatus !== "ready") {
      setHealth(null);
      return undefined;
    }
    let cancelled = false;
    void fetchSidecarHealth()
      .then((h) => {
        if (!cancelled) setHealth(h);
      })
      .catch(() => {
        if (!cancelled) setHealth(null);
      });
    return () => {
      cancelled = true;
    };
  }, [sidecarAiStatus]);

  useEffect(() => {
    return () => {
      if (coverUrl) URL.revokeObjectURL(coverUrl);
    };
  }, [coverUrl]);

  const imageStylePreview = useMemo(
    () => (imageAnalysis ? buildSunoV55StyleFromImageAnalysis(imageAnalysis).styleLine : ""),
    [imageAnalysis],
  );
  const audioStylePreview = useMemo(
    () => (audioAnalysis ? buildSunoV55StyleFromAudioAnalysis(audioAnalysis).styleLine : ""),
    [audioAnalysis],
  );

  const defaultPrompt = useMemo(
    () =>
      buildCoverPromptFromStyle(
        resolveCoverPromptSource({
          sunoPasteStyle,
          sunoFieldStyle: sunoFieldSlices?.style,
          imageStylePreview,
          audioStylePreview,
          idea,
        }),
      ),
    [audioStylePreview, idea, imageStylePreview, sunoFieldSlices?.style, sunoPasteStyle],
  );

  const prompt = promptOverride.trim() || defaultPrompt;
  const coverReady = Boolean(health?.cover_available);
  const coverRefReady = Boolean(health?.cover_ref_available);
  const coverHint = coverInstallHint(health);
  const coverRefHint = coverRefInstallHint(health);

  const setCoverBlob = useCallback(
    (blob) => {
      setCoverUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
    },
    [],
  );

  const beginOperation = useCallback(() => {
    operationAbortRef.current?.abort();
    const controller = new AbortController();
    const generation = operationGenerationRef.current + 1;
    operationGenerationRef.current = generation;
    operationAbortRef.current = controller;
    setBusy(true);
    return { controller, generation };
  }, []);

  const operationIsCurrent = useCallback(
    (operation) =>
      !operation.controller.signal.aborted &&
      operation.generation === operationGenerationRef.current,
    [],
  );

  const finishOperation = useCallback((operation) => {
    if (operation.generation !== operationGenerationRef.current) return;
    if (operationAbortRef.current === operation.controller) operationAbortRef.current = null;
    setBusy(false);
  }, []);

  useWorkspaceResetEffect(() => {
    operationGenerationRef.current += 1;
    operationAbortRef.current?.abort();
    operationAbortRef.current = null;
    setBusy(false);
    setStrength(0.55);
    setPromptOverride("");
    setCoverUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  });

  useEffect(
    () => () => {
      operationGenerationRef.current += 1;
      operationAbortRef.current?.abort();
      operationAbortRef.current = null;
    },
    [],
  );

  const onGenerateCover = useCallback(async () => {
    if (!coverReady) {
      setStatusWithTime(`Cover generation requires ${coverHint}`, "warning");
      return;
    }
    const operation = beginOperation();
    try {
      captureSnapshot?.("before cover generate");
      const out = await generateCoverViaSidecar({ prompt, signal: operation.controller.signal });
      if (!operationIsCurrent(operation)) return;
      setCoverBlob(out.blob);
      setStatusWithTime(`Cover generated (${out.model || "FLUX"})`);
    } catch (err) {
      if (!operationIsCurrent(operation)) return;
      setStatusWithTime(err instanceof Error ? err.message : "Cover generation failed", "error");
    } finally {
      finishOperation(operation);
    }
  }, [beginOperation, captureSnapshot, coverHint, coverReady, finishOperation, operationIsCurrent, prompt, setCoverBlob, setStatusWithTime]);

  const onGenerateCoverRef = useCallback(async () => {
    if (!imagePreview) {
      setStatusWithTime("Drop an image in Analyzers first", "warning");
      return;
    }
    if (!coverRefReady) {
      setStatusWithTime(`Cover-from-image requires ${coverRefHint}`, "warning");
      return;
    }
    const operation = beginOperation();
    try {
      captureSnapshot?.("before cover-ref generate");
      const imgRes = await fetch(imagePreview, { signal: operation.controller.signal });
      if (!imgRes.ok) throw new Error("Could not read analyzer image");
      const imgBlob = await imgRes.blob();
      const out = await generateCoverRefViaSidecar({
        prompt,
        image: imgBlob,
        strength,
        signal: operation.controller.signal,
      });
      if (!operationIsCurrent(operation)) return;
      setCoverBlob(out.blob);
      setStatusWithTime(`Cover from image generated (${out.model || "FLUX img2img"})`);
    } catch (err) {
      if (!operationIsCurrent(operation)) return;
      setStatusWithTime(err instanceof Error ? err.message : "Cover-ref generation failed", "error");
    } finally {
      finishOperation(operation);
    }
  }, [
    beginOperation,
    captureSnapshot,
    coverRefHint,
    coverRefReady,
    finishOperation,
    imagePreview,
    operationIsCurrent,
    prompt,
    setCoverBlob,
    setStatusWithTime,
    strength,
  ]);

  const onDownloadCover = useCallback(() => {
    if (!coverUrl) return;
    const a = document.createElement("a");
    a.href = coverUrl;
    a.download = "album-cover.png";
    a.click();
  }, [coverUrl]);

  return (
    <Panel
      title="Album Cover"
      hint="Optional FLUX artwork for the current music release."
    >
      <label className="block text-[10px] text-white/50">
        Cover prompt
        <textarea
          value={promptOverride || defaultPrompt}
          onChange={(e) => setPromptOverride(e.target.value)}
          rows={3}
          className="mt-1 w-full resize-y rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-xs text-white outline-none focus:border-fuchsia-400/50"
        />
      </label>

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void onGenerateCover()}
          className="rounded-2xl border border-fuchsia-400/40 bg-fuchsia-500/20 py-2 text-xs font-bold text-fuchsia-50 hover:bg-fuchsia-500/30 disabled:opacity-50"
          title={coverReady ? "Generate with FLUX.1-schnell" : coverHint}
        >
          {coverReady ? "Generate cover" : `Install cover — ${coverHint}`}
        </button>
        <button
          type="button"
          disabled={busy || !imagePreview}
          onClick={() => void onGenerateCoverRef()}
          className="rounded-2xl border border-violet-400/40 bg-violet-500/20 py-2 text-xs font-bold text-violet-50 hover:bg-violet-500/30 disabled:opacity-50"
          title={
            !imagePreview
              ? "Need analyzer image"
              : coverRefReady
                ? "FLUX img2img from reference"
                : coverRefHint
          }
        >
          {coverRefReady ? "Generate cover from image" : `Install cover-ref — ${coverRefHint}`}
        </button>
      </div>

      {imagePreview ? (
        <label className="mt-2 block text-[10px] text-white/50">
          Img2img strength ({strength.toFixed(2)})
          <input
            type="range"
            min={0.15}
            max={0.95}
            step={0.05}
            value={strength}
            disabled={busy}
            onChange={(e) => setStrength(Number(e.target.value))}
            className="mt-1 w-full"
          />
        </label>
      ) : (
        <p className="mt-2 text-[10px] text-white/40">Drop art in Analyzers to unlock cover-from-image.</p>
      )}

      {coverUrl ? (
        <div className="mt-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={coverUrl} alt="Generated cover" className="mx-auto max-h-48 rounded-2xl object-contain" />
          <button
            type="button"
            onClick={onDownloadCover}
            className="mt-2 w-full rounded-2xl border border-white/15 bg-black/30 py-2 text-xs font-semibold text-white/70 hover:text-white"
          >
            Download cover PNG
          </button>
        </div>
      ) : null}
    </Panel>
  );
});
