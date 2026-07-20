"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { AudioTrackEditor } from "./audio-track-editor";
import { DropBox, Panel } from "./ui-blocks";
import { getImageAnalyzerDisclaimer } from "../lib/analyzer-disclaimer";
import {
  SUPPORTED_AUDIO_ACCEPT,
  SUPPORTED_AUDIO_LABEL,
  SUPPORTED_IMAGE_ACCEPT,
  SUPPORTED_IMAGE_LABEL,
} from "../lib/analyzer-file-types";
import { buildMoodWords } from "../lib/music-helpers";
import { buildMusicGenPrompt } from "../lib/musicgen-prompt";
import { MusicGenPreviewControls } from "./musicgen-preview-controls";
import { FailSafeBotPanel } from "./fail-safe-bot-panel";
import { musicGenInstallHint, missingSidecarInstallHints } from "../lib/sidecar-capabilities";
import { fetchSidecarHealth } from "../lib/sidecar-bridge";
import {
  SUNO_LYRICS_CHAR_TYPICAL_MAX,
  SUNO_LYRICS_CHAR_WARN,
  SUNO_STYLE_CHAR_CAP,
  SUNO_STYLE_CHAR_WARN,
} from "../lib/suno-limits";
import {
  useProjectWorkspaceActions,
  useProjectWorkspaceAnalyzerState,
  useProjectWorkspaceProjectState,
  useProjectWorkspacePromptState,
} from "../context/project-workspace-context";

export const CenterAnalyzersPanel = memo(function CenterAnalyzersPanel() {
  const { promptEngine, idea, mood, selectedGenres, selectedSounds, selectedRhythms, tempo } =
    useProjectWorkspaceProjectState();
  const { sunoFieldSlices, sourcePrompt } = useProjectWorkspacePromptState();
  const {
    sidecarAiStatus,
    sidecarGenerateAvailable,
    audioAnalysis,
    audioPreviewUrl,
    audioLoudness,
    audioLoudnessBusy,
    audioExportBusy,
    audioExportProgress,
    imageAnalysis,
    imagePreview,
    stemSeparationBusy,
    stemSeparationStems,
    generateMusicBusy,
  } = useProjectWorkspaceAnalyzerState();
  const {
    analyzeAudioFile,
    analyzeImageFile,
    updateAudioAnalysis,
    captureSnapshot,
    applyAudioToSunoStyle,
    clearAudioAnalysis,
    attachAudioFile,
    addLyricsFromInstrumentalTrack,
    handoffTrackToVoiceCharacterStudio,
    exportEnhancedAudio,
    separateStems,
    downloadStem,
    generateMusicFromPrompt,
    applyImageToSunoStyle,
    copyToClipboard,
    openInCanvasTool,
  } = useProjectWorkspaceActions();

  const defaultMusicGenPrompt = useMemo(
    () =>
      buildMusicGenPrompt({
        selectedGenres,
        selectedSounds,
        selectedRhythms,
        tempo,
        idea,
        moodWords: buildMoodWords(mood),
        audioAnalysis,
      }),
    [audioAnalysis, idea, mood, selectedGenres, selectedRhythms, selectedSounds, tempo],
  );

  const [sidecarHealth, setSidecarHealth] = useState(null);
  useEffect(() => {
    if (sidecarAiStatus !== "ready") {
      setSidecarHealth(null);
      return undefined;
    }
    let cancelled = false;
    void fetchSidecarHealth().then((h) => {
      if (!cancelled) setSidecarHealth(h);
    });
    return () => {
      cancelled = true;
    };
  }, [sidecarAiStatus, sidecarGenerateAvailable]);

  const musicGenHint = musicGenInstallHint(sidecarHealth);
  const missingCaps = missingSidecarInstallHints(sidecarHealth);

  return (
    <>
      <Panel
        title="Drag & Drop Analyzers"
        data-testid="drag-drop-analyzers"
        hint="Optional Polish-step tools — track report with waveform, LUFS/dBTP meter, studio WAV export (Streaming −14 LUFS), merge into Suno fields, Goal, and Notes. Image DNA uses compact AUDIO:/IMAGE: lines for the 1000-character Style cap."
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full border px-2.5 py-1 font-mono text-[10px] ${
              sidecarAiStatus === "ready"
                ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-100"
                : sidecarAiStatus === "checking"
                  ? "border-cyan-400/30 bg-cyan-500/10 text-cyan-100"
                  : sidecarAiStatus === "standby"
                    ? "border-amber-400/35 bg-amber-500/10 text-amber-50"
                    : "border-white/15 bg-black/30 text-white/45"
            }`}
            title="Local librosa sidecar for tempo/key analysis"
          >
            AI sidecar:{" "}
            {sidecarAiStatus === "ready"
              ? "librosa ready"
              : sidecarAiStatus === "checking"
                ? "checking…"
                : sidecarAiStatus === "standby"
                  ? "on-demand (starts when you analyze)"
                  : "offline (heuristic BPM/key)"}
          </span>
          <span
            className={`rounded-full border px-2.5 py-1 font-mono text-[10px] ${
              sidecarGenerateAvailable
                ? "border-violet-400/40 bg-violet-500/15 text-violet-100"
                : sidecarAiStatus === "ready"
                  ? "border-amber-400/35 bg-amber-500/10 text-amber-50"
                  : "border-white/15 bg-black/30 text-white/45"
            }`}
            title={`MusicGen preview via sidecar POST /generate (${musicGenHint})`}
          >
            MusicGen:{" "}
            {sidecarGenerateAvailable
              ? "ready"
              : sidecarAiStatus === "ready"
                ? `install extra (${musicGenHint})`
                : "needs sidecar"}
          </span>
        </div>
        {sidecarAiStatus === "ready" && missingCaps.length ? (
          <ul className="mb-2 space-y-0.5 rounded-xl border border-white/10 bg-black/25 px-3 py-2 font-mono text-[10px] text-white/50">
            {missingCaps.map((cap) => (
              <li key={cap.id}>
                <span className="text-white/70">{cap.title}</span>
                {" — "}
                <code className="text-cyan-100/80">{cap.install_hint}</code>
              </li>
            ))}
          </ul>
        ) : null}
        <FailSafeBotPanel />
        <div
          className={`mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-2xl border px-3 py-2 font-mono text-[11px] leading-snug ${
            sunoFieldSlices.style.length > SUNO_STYLE_CHAR_CAP
              ? "border-red-400/45 bg-red-500/15 text-red-100"
              : sunoFieldSlices.style.length > SUNO_STYLE_CHAR_WARN
                ? "border-amber-400/40 bg-amber-500/10 text-amber-50"
                : "border-emerald-400/30 bg-emerald-500/10 text-emerald-50"
          }`}
        >
          <span>
            Style box: {sunoFieldSlices.style.length}/{SUNO_STYLE_CHAR_CAP}
            {promptEngine !== "Suno-like" ? (
              <span className="ml-1.5 font-sans text-[10px] font-normal text-white/40">
                (same string as validator when you use Suno-like)
              </span>
            ) : null}
          </span>
          <span
            className={
              sunoFieldSlices.lyrics.length > SUNO_LYRICS_CHAR_TYPICAL_MAX
                ? "text-red-200"
                : sunoFieldSlices.lyrics.length > SUNO_LYRICS_CHAR_WARN
                  ? "text-amber-200"
                  : "text-white/55"
            }
          >
            Lyrics: {sunoFieldSlices.lyrics.length}/{SUNO_LYRICS_CHAR_TYPICAL_MAX}
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <DropBox
            title="Drop Audio File"
            hint={SUPPORTED_AUDIO_LABEL}
            accept={SUPPORTED_AUDIO_ACCEPT}
            onFile={analyzeAudioFile}
          >
            {!audioAnalysis ? (
              <div className="mt-3">
                <MusicGenPreviewControls
                  defaultPrompt={defaultMusicGenPrompt}
                  busy={generateMusicBusy}
                  available={sidecarGenerateAvailable}
                  installHint={musicGenHint}
                  canUseMelodyReference={!!audioPreviewUrl}
                  onGenerate={generateMusicFromPrompt}
                  compact
                />
              </div>
            ) : null}
            {audioAnalysis ? (
              <AudioTrackEditor
                analysis={audioAnalysis}
                audioUrl={audioPreviewUrl}
                onChange={updateAudioAnalysis}
                onApply={() => {
                  captureSnapshot("before audio merge");
                  applyAudioToSunoStyle();
                }}
                onClear={clearAudioAnalysis}
                onAttachAudio={attachAudioFile}
                onAddLyricsForTrack={addLyricsFromInstrumentalTrack}
                onAnalyzeVocalCharacter={handoffTrackToVoiceCharacterStudio}
                loudness={audioLoudness}
                loudnessBusy={audioLoudnessBusy}
                onExportEnhanced={exportEnhancedAudio}
                onSeparateStems={separateStems}
                onDownloadStem={downloadStem}
                stemSeparationBusy={stemSeparationBusy}
                stemSeparationStems={stemSeparationStems}
                onGenerateMusic={generateMusicFromPrompt}
                generateMusicBusy={generateMusicBusy}
                sidecarGenerateAvailable={sidecarGenerateAvailable}
                musicGenInstallHint={musicGenHint}
                defaultMusicGenPrompt={defaultMusicGenPrompt}
                exportBusy={audioExportBusy}
                exportProgress={audioExportProgress}
              />
            ) : null}
          </DropBox>
          <DropBox
            title="Drop Image File"
            hint={SUPPORTED_IMAGE_LABEL}
            accept={SUPPORTED_IMAGE_ACCEPT}
            onFile={analyzeImageFile}
          >
            {imagePreview ? (
              /* eslint-disable-next-line @next/next/no-img-element -- blob Object URLs from analyzer */
              <img
                src={imagePreview}
                alt="Image preview"
                className="mx-auto mt-3 max-h-40 rounded-2xl object-contain"
              />
            ) : null}
            {imagePreview ? (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void openInCanvasTool();
                }}
                className="mt-3 w-full rounded-2xl border border-emerald-400/45 bg-emerald-500/20 py-2.5 text-xs font-bold text-emerald-50 hover:bg-emerald-500/30"
              >
                Open in Canvas Tool → Spotify loop
              </button>
            ) : (
              <p className="mt-3 text-[10px] text-white/45">
                Suite addon: install{" "}
                <span className="font-bold text-emerald-200/90">AI Canvas Tool</span> from the left{" "}
                <span className="font-bold text-white/70">Suite Addons</span> menu, then drop art here
                for Spotify loop handoff.
              </p>
            )}
            {imageAnalysis ? (
              <div className="mt-3 text-left">
                <p className="mb-2 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-[10px] leading-relaxed text-amber-100/90">
                  {getImageAnalyzerDisclaimer(imageAnalysis)}
                </p>
                <div className="rounded-2xl bg-black/30 p-3 text-xs whitespace-pre-wrap text-white/70">
                  {imageAnalysis.summary}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    captureSnapshot("before image merge");
                    applyImageToSunoStyle();
                  }}
                  className="mt-2 w-full rounded-2xl border border-fuchsia-400/40 bg-fuchsia-500/20 py-2 text-xs font-bold text-fuchsia-50 hover:bg-fuchsia-500/30"
                >
                  Add image style to Suno (merge) → next step
                </button>
              </div>
            ) : null}
          </DropBox>
        </div>
      </Panel>

      {sourcePrompt.trim() ? (
        <Panel title="Extracted Source Prompt" hint="Copy only the prompt created from audio/image analysis.">
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-2xl border border-orange-300/20 bg-black/50 p-4 text-xs leading-relaxed text-orange-50">
            {sourcePrompt}
          </pre>
          <button
            onClick={() => copyToClipboard(sourcePrompt, "Extracted prompt copied")}
            className="mt-3 w-full rounded-2xl bg-orange-300 px-4 py-2 font-bold text-black hover:bg-orange-200"
          >
            Copy Extracted Prompt
          </button>
        </Panel>
      ) : null}
    </>
  );
});
