"use client";

import { useEffect, useState } from "react";
import { resolveAudioCacheBlob } from "../lib/audio-cache";
import { downloadMusicGenBlob } from "../lib/musicgen-preview";

function DraftTake({ take, selected, busy, onSelect }) {
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    let objectUrl;
    void resolveAudioCacheBlob(take).then(cached => {
      if (!active) return;
      if (cached) { objectUrl = URL.createObjectURL(cached.blob); setUrl(objectUrl); }
      else setMessage("Audio missing from local storage");
    });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [take]);
  async function download() {
    try {
      const cached = await resolveAudioCacheBlob(take);
      if (!cached) throw new Error("Audio missing from local storage");
      await downloadMusicGenBlob(cached.blob, take.fileName);
      setMessage("Take saved");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Save failed"); }
  }
  return <div className="rounded-lg border border-white/15 p-2 space-y-1">
    <p className="text-xs text-white/80">Take {take.index + 1} · seed {take.seed}{selected ? " · selected" : ""}</p>
    {take.score != null ? <p className="text-[10px] text-white/50">Style match {take.score.toFixed(3)} · prompt {take.prompt_score.toFixed(3)}{take.reference_score == null ? "" : ` · reference ${take.reference_score.toFixed(3)}`}</p> : null}
    {url ? <audio controls preload="metadata" src={url} className="w-full" aria-label={`Play take ${take.index + 1}`} /> : null}
    <div className="flex gap-2">
      <button type="button" disabled={busy || !url || selected} onClick={() => onSelect(take)} className="rounded border border-violet-400/30 px-2 py-1 text-[10px] text-white disabled:opacity-40">Use take {take.index + 1}</button>
      <button type="button" disabled={busy || !url} onClick={() => void download()} className="rounded border border-white/20 px-2 py-1 text-[10px] text-white disabled:opacity-40">Save take {take.index + 1}</button>
    </div>
    {message ? <p role="status" className="text-[10px] text-amber-100">{message}</p> : null}
  </div>;
}

export function MusicGenDraftTakes({ search, busy, onSelect }) {
  if (!search?.candidates?.length) return null;
  return <section aria-label="Local draft comparison" className="space-y-2">
    <p className="text-[10px] text-white/55">{search.note} Scores are similarities, not percentages or a Suno quality rating.</p>
    {search.candidates.map(take => <DraftTake key={take.index} take={take} selected={take.index === search.selected_index} busy={busy} onSelect={onSelect} />)}
  </section>;
}
