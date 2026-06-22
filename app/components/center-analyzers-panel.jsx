"use client";

import { memo } from "react";
import { AudioTrackEditor } from "./audio-track-editor";
import { DropBox, Panel } from "./ui-blocks";
import { IMAGE_ANALYZER_DISCLAIMER } from "../lib/analyzer-disclaimer";
import {
  SUPPORTED_AUDIO_ACCEPT,
  SUPPORTED_AUDIO_LABEL,
  SUPPORTED_IMAGE_ACCEPT,
  SUPPORTED_IMAGE_LABEL,
} from "../lib/analyzer-file-types";
import {
  SUNO_LYRICS_CHAR_TYPICAL_MAX,
  SUNO_LYRICS_CHAR_WARN,
  SUNO_STYLE_CHAR_CAP,
  SUNO_STYLE_CHAR_WARN,
} from "../lib/suno-limits";
import { useProjectWorkspace } from "../context/project-workspace-context";

export const CenterAnalyzersPanel = memo(function CenterAnalyzersPanel() {
  const ws = useProjectWorkspace();

  return (
    <>
      <Panel
        title="Drag & Drop Analyzers"
        hint="Optional Polish-step tools — track report with waveform, LUFS/dBTP meter, studio WAV export (Streaming −14 LUFS), merge into Suno fields, Goal, and Notes. Image DNA uses compact AUDIO:/IMAGE: lines for the 1000-character Style cap."
      >
        <div
          className={`mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-2xl border px-3 py-2 font-mono text-[11px] leading-snug ${
            ws.sunoFieldSlices.style.length > SUNO_STYLE_CHAR_CAP
              ? "border-red-400/45 bg-red-500/15 text-red-100"
              : ws.sunoFieldSlices.style.length > SUNO_STYLE_CHAR_WARN
                ? "border-amber-400/40 bg-amber-500/10 text-amber-50"
                : "border-emerald-400/30 bg-emerald-500/10 text-emerald-50"
          }`}
        >
          <span>
            Style box: {ws.sunoFieldSlices.style.length}/{SUNO_STYLE_CHAR_CAP}
            {ws.promptEngine !== "Suno-like" ? (
              <span className="ml-1.5 font-sans text-[10px] font-normal text-white/40">
                (same string as validator when you use Suno-like)
              </span>
            ) : null}
          </span>
          <span
            className={
              ws.sunoFieldSlices.lyrics.length > SUNO_LYRICS_CHAR_TYPICAL_MAX
                ? "text-red-200"
                : ws.sunoFieldSlices.lyrics.length > SUNO_LYRICS_CHAR_WARN
                  ? "text-amber-200"
                  : "text-white/55"
            }
          >
            Lyrics: {ws.sunoFieldSlices.lyrics.length}/{SUNO_LYRICS_CHAR_TYPICAL_MAX}
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <DropBox
            title="Drop Audio File"
            hint={SUPPORTED_AUDIO_LABEL}
            accept={SUPPORTED_AUDIO_ACCEPT}
            onFile={ws.analyzeAudioFile}
          >
            {ws.audioAnalysis ? (
              <AudioTrackEditor
                analysis={ws.audioAnalysis}
                audioUrl={ws.audioPreviewUrl}
                onChange={ws.updateAudioAnalysis}
                onApply={() => {
                  ws.captureSnapshot("before audio merge");
                  ws.applyAudioToSunoStyle();
                }}
                onClear={ws.clearAudioAnalysis}
                onAttachAudio={ws.attachAudioFile}
                onAddLyricsForTrack={ws.addLyricsFromInstrumentalTrack}
                onAnalyzeVocalCharacter={ws.handoffTrackToVoiceCharacterStudio}
                loudness={ws.audioLoudness}
                loudnessBusy={ws.audioLoudnessBusy}
                onExportEnhanced={ws.exportEnhancedAudio}
                exportBusy={ws.audioExportBusy}
                exportProgress={ws.audioExportProgress}
              />
            ) : null}
          </DropBox>
          <DropBox
            title="Drop Image File"
            hint={SUPPORTED_IMAGE_LABEL}
            accept={SUPPORTED_IMAGE_ACCEPT}
            onFile={ws.analyzeImageFile}
          >
            {ws.imagePreview && (
              /* eslint-disable-next-line @next/next/no-img-element -- blob Object URLs from analyzer */
              <img
                src={ws.imagePreview}
                alt="Image preview"
                className="mx-auto mt-3 max-h-40 rounded-2xl object-contain"
              />
            )}
            {ws.imagePreview ? (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  ws.openInCanvasTool();
                }}
                className="mt-3 w-full rounded-2xl border border-emerald-400/45 bg-emerald-500/20 py-2.5 text-xs font-bold text-emerald-50 hover:bg-emerald-500/30"
              >
                Open in Canvas Tool → Spotify loop
              </button>
            ) : null}
            {ws.imageAnalysis ? (
              <div className="mt-3 text-left">
                <p className="mb-2 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-[10px] leading-relaxed text-amber-100/90">
                  {IMAGE_ANALYZER_DISCLAIMER}
                </p>
                <div className="rounded-2xl bg-black/30 p-3 text-xs whitespace-pre-wrap text-white/70">
                  {ws.imageAnalysis.summary}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    ws.captureSnapshot("before image merge");
                    ws.applyImageToSunoStyle();
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

      {ws.sourcePrompt.trim() ? (
        <Panel title="Extracted Source Prompt" hint="Copy only the prompt created from audio/image analysis.">
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-2xl border border-orange-300/20 bg-black/50 p-4 text-xs leading-relaxed text-orange-50">
            {ws.sourcePrompt}
          </pre>
          <button
            onClick={() => ws.copyToClipboard(ws.sourcePrompt, "Extracted prompt copied")}
            className="mt-3 w-full rounded-2xl bg-orange-300 px-4 py-2 font-bold text-black hover:bg-orange-200"
          >
            Copy Extracted Prompt
          </button>
        </Panel>
      ) : null}
    </>
  );
});
