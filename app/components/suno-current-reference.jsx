"use client";

import { SUNO_CURRENT, SUNO_DRAFT_GUIDANCE } from "../lib/suno-current";

export function SunoCurrentReference() {
  return (
    <details className="rounded-xl border border-cyan-400/20 bg-cyan-950/20 p-3 text-xs" data-testid="suno-current-reference">
      <summary className="cursor-pointer font-bold text-cyan-100">Suno v6 · checked {SUNO_CURRENT.verifiedAt}</summary>
      <div className="mt-3 space-y-2 text-white/70">
        <p>{SUNO_DRAFT_GUIDANCE}</p>
        <ul className="space-y-1">
          {SUNO_CURRENT.models.map((model) => <li key={model.id}>{model.id}: {model.purpose} ({model.plans.join(" / ")}).</li>)}
        </ul>
        <p>Earlier generation models are retired. Existing songs remain in your library.</p>
        <p>Standard generation: two songs for 10 credits. Extra media and Max Mode can cost more.</p>
        <p>Audio uploads: up to 8 minutes on Free; 30 minutes on Pro/Premier. A 30-second local draft is a practical starting point.</p>
        <p>This app uses 1,000 Style and 5,000 Lyrics characters as copy budgets; current v6 hard limits have not been independently confirmed.</p>
        <p>Custom Models: at least six songs; up to three private models on Pro/Premier. Voices accepts a 15-second to 4-minute recording, with up to 2 minutes selected for the profile.</p>
        <ul className="space-y-1 text-white/50">
          {SUNO_CURRENT.latestUpdates.map((update) => <li key={update.date}>{update.date}: {update.text}</li>)}
        </ul>
        <div className="flex flex-wrap gap-3 text-cyan-200 underline">
          <a href={SUNO_CURRENT.sources.models} target="_blank" rel="noreferrer">Official v6 guide</a>
          <a href={SUNO_CURRENT.sources.plans} target="_blank" rel="noreferrer">Current plans and uploads</a>
          <a href={SUNO_CURRENT.sources.updates} target="_blank" rel="noreferrer">Release notes</a>
          <a href={SUNO_CURRENT.sources.customModels} target="_blank" rel="noreferrer">Custom Models</a>
          <a href={SUNO_CURRENT.sources.voices} target="_blank" rel="noreferrer">Voices</a>
          <a href={SUNO_CURRENT.sources.myTaste} target="_blank" rel="noreferrer">My Taste</a>
        </div>
      </div>
    </details>
  );
}
