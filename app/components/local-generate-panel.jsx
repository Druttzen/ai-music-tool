"use client";

import { memo, useState } from "react";
import { AceStepSongControls } from "./acestep-song-controls";
import { MusicGenPreviewControls } from "./musicgen-preview-controls";

/**
 * One local-generate surface: MusicGen sketch or ACE-Step full song.
 */
export const LocalGeneratePanel = memo(function LocalGeneratePanel({
  music,
  song,
}) {
  const [mode, setMode] = useState("sketch");
  if (!music?.onGenerate && !song?.onGenerate) return null;

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-white/70">Local generate</span>
        <button
          type="button"
          onClick={() => setMode("sketch")}
          className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
            mode === "sketch"
              ? "border-violet-400/50 bg-violet-500/20 text-violet-50"
              : "border-white/15 text-white/50"
          }`}
        >
          Sketch · CC-BY-NC
        </button>
        <button
          type="button"
          onClick={() => setMode("song")}
          className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
            mode === "song"
              ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-50"
              : "border-white/15 text-white/50"
          }`}
        >
          Full song · MIT
        </button>
      </div>
      {mode === "sketch" ? <MusicGenPreviewControls {...music} /> : <AceStepSongControls {...song} />}
    </section>
  );
});
