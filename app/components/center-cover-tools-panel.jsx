"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
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
import { openMusicVideoHandoff } from "../lib/suite-music-video-client";

/**
 * Opt-in cover generation (FLUX) + music video suite handoff.
 */
export const CenterCoverToolsPanel = memo(function CenterCoverToolsPanel() {
  const { idea, sunoPasteStyle } = useProjectWorkspaceProjectState();
  const { sunoFieldSlices } = useProjectWorkspacePromptState();
  const { sidecarAiStatus, audioAnalysis, imageAnalysis, imagePreview, audioPreviewUrl } =
    useProjectWorkspaceAnalyzerState();
  const { setStatusWithTime, captureSnapshot } = useProjectWorkspaceActions();

  const [health, setHealth] = useState(null);
  const [busy, setBusy] = useState(false);
  const [strength, setStrength] = useState(0.55);
  const [coverUrl, setCoverUrl] = useState(/** @type {string|null} */ (null));
  const [promptOverride, setPromptOverride] = useState("");

  useEffect(() => {
    if (sidecarAiStatus !== "ready") {
      setHealth(null);
      return undefined;
    }
    let cancelled = false;
    void fetchSidecarHealth().then((h) => {
      if (!cancelled) setHealth(h);
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

  const onGenerateCover = useCallback(async () => {
    if (!coverReady) {
      setStatusWithTime(`Cover generation requires ${coverHint}`, "warning");
      return;
    }
    setBusy(true);
    try {
      captureSnapshot?.("before cover generate");
      const out = await generateCoverViaSidecar({ prompt });
      setCoverBlob(out.blob);
      setStatusWithTime(`Cover generated (${out.model || "FLUX"})`);
    } catch (err) {
      setStatusWithTime(err instanceof Error ? err.message : "Cover generation failed", "error");
    } finally {
      setBusy(false);
    }
  }, [captureSnapshot, coverHint, coverReady, prompt, setCoverBlob, setStatusWithTime]);

  const onGenerateCoverRef = useCallback(async () => {
    if (!imagePreview) {
      setStatusWithTime("Drop an image in Analyzers first", "warning");
      return;
    }
    if (!coverRefReady) {
      setStatusWithTime(`Cover-from-image requires ${coverRefHint}`, "warning");
      return;
    }
    setBusy(true);
    try {
      captureSnapshot?.("before cover-ref generate");
      const imgRes = await fetch(imagePreview);
      const imgBlob = await imgRes.blob();
      const out = await generateCoverRefViaSidecar({
        prompt,
        image: imgBlob,
        strength,
      });
      setCoverBlob(out.blob);
      setStatusWithTime(`Cover from image generated (${out.model || "FLUX img2img"})`);
    } catch (err) {
      setStatusWithTime(err instanceof Error ? err.message : "Cover-ref generation failed", "error");
    } finally {
      setBusy(false);
    }
  }, [
    captureSnapshot,
    coverRefHint,
    coverRefReady,
    imagePreview,
    prompt,
    setCoverBlob,
    setStatusWithTime,
    strength,
  ]);

  const onOpenMusicVideo = useCallback(async () => {
    setBusy(true);
    try {
      const result = await openMusicVideoHandoff({
        audioUrl: audioPreviewUrl || null,
        coverUrl: coverUrl || imagePreview || null,
        prompt,
        bpm: audioAnalysis?.estimatedBpm || "",
        idea,
      });
      setStatusWithTime(result.message, result.ok ? "info" : "error");
    } catch (err) {
      setStatusWithTime(err instanceof Error ? err.message : "Music video handoff failed", "error");
    } finally {
      setBusy(false);
    }
  }, [audioAnalysis?.estimatedBpm, audioPreviewUrl, coverUrl, idea, imagePreview, prompt, setStatusWithTime]);

  const onDownloadCover = useCallback(() => {
    if (!coverUrl) return;
    const a = document.createElement("a");
    a.href = coverUrl;
    a.download = "album-cover.png";
    a.click();
  }, [coverUrl]);

  return (
    <Panel
      title="Cover & Music Video"
      hint="Opt-in FLUX covers (npm run sidecar:cover / cover-ref) and Suite Music Video handoff."
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

      <button
        type="button"
        disabled={busy}
        onClick={() => void onOpenMusicVideo()}
        className="mt-3 w-full rounded-2xl border border-emerald-400/40 bg-emerald-500/15 py-2 text-xs font-bold text-emerald-50 hover:bg-emerald-500/25 disabled:opacity-50"
      >
        Open in Music Video tool →
      </button>
    </Panel>
  );
});
