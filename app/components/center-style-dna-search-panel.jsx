"use client";

import { memo, useCallback, useState } from "react";
import { Panel } from "./ui-blocks";
import { useProjectWorkspace } from "../context/project-workspace-context";
import { saveStyleDnaSettings, isSpotifyStyleDnaReady } from "../lib/style-dna-settings";
import { searchTrackStyleDna } from "../lib/track-style-dna";

export const CenterStyleDnaSearchPanel = memo(function CenterStyleDnaSearchPanel() {
  const ws = useProjectWorkspace();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState(/** @type {Array<object>} */ ([]));
  const [provider, setProvider] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);

  const spotifyReady = isSpotifyStyleDnaReady(ws.styleDnaSettings);

  const runSearch = useCallback(async () => {
    setError("");
    setBusy(true);
    try {
      const out = await searchTrackStyleDna(query, ws.styleDnaSettings);
      setResults(out.mapped);
      setProvider(out.provider);
      setSelectedIdx(0);
      ws.setStatusWithTime(
        out.resolvedQuery
          ? `Style DNA: ${out.mapped.length} hit(s) via ${out.provider} (YouTube → "${out.resolvedQuery}")`
          : `Style DNA: ${out.mapped.length} hit(s) via ${out.provider}`,
      );
    } catch (err) {
      setResults([]);
      setError(err instanceof Error ? err.message : "Search failed");
      ws.setStatusWithTime("Style DNA search failed", "error");
    } finally {
      setBusy(false);
    }
  }, [query, ws]);

  const selected = results[selectedIdx] || null;

  return (
    <Panel
      title="Style-DNA Search"
      hint="Search by artist/title, Spotify track URL, or YouTube link. Spotify audio features give the richest Suno tokens; MusicBrainz is the free fallback."
      data-testid="style-dna-search-panel"
    >
      <p className="mb-3 text-[11px] leading-relaxed text-white/50">
        Online reference lookup — not audio fingerprinting. Add Spotify credentials for danceability,
        energy, valence, tempo, and artist genres. Keys stay in your browser only.
      </p>

      <div className="mb-3 rounded-2xl border border-indigo-300/20 bg-indigo-950/25 p-3">
        <div className="mb-2 text-xs font-bold uppercase tracking-wider text-indigo-200/80">
          Optional Spotify API
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[10px] uppercase text-white/40">Client ID</span>
            <input
              value={ws.styleDnaSettings.spotifyClientId}
              onChange={(e) =>
                ws.setStyleDnaSettings({ ...ws.styleDnaSettings, spotifyClientId: e.target.value })
              }
              className="w-full rounded-xl border border-white/10 bg-black/30 p-2 text-xs text-white outline-none"
              autoComplete="off"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] uppercase text-white/40">Client Secret</span>
            <input
              type="password"
              value={ws.styleDnaSettings.spotifyClientSecret}
              onChange={(e) =>
                ws.setStyleDnaSettings({
                  ...ws.styleDnaSettings,
                  spotifyClientSecret: e.target.value,
                })
              }
              className="w-full rounded-xl border border-white/10 bg-black/30 p-2 text-xs text-white outline-none"
              autoComplete="off"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={() => {
            saveStyleDnaSettings(ws.styleDnaSettings);
            ws.setStatusWithTime("Style DNA Spotify settings saved");
          }}
          className="mt-2 rounded-xl border border-indigo-300/30 bg-indigo-900/40 px-3 py-1.5 text-xs font-bold text-indigo-100 hover:bg-indigo-900/60"
        >
          Save Spotify settings
        </button>
        {!spotifyReady && (
          <p className="mt-2 text-[10px] text-white/40">
            Without Spotify, searches use MusicBrainz tags only (no audio feature DNA).
          </p>
        )}
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-white/45">
          Search
        </span>
        <input
          data-testid="style-dna-search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") runSearch();
          }}
          placeholder='e.g. "Daft Punk Harder Better Faster" or Spotify / YouTube URL'
          className="w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-sm text-white outline-none focus:border-indigo-300/40"
        />
      </label>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="style-dna-search-button"
          onClick={runSearch}
          disabled={busy || !query.trim()}
          className="rounded-2xl bg-indigo-300 px-4 py-2 text-sm font-bold text-black hover:bg-indigo-200 disabled:opacity-40"
        >
          {busy ? "Searching…" : "Search Style DNA"}
        </button>
        {selected && (
          <>
            <button
              type="button"
              data-testid="style-dna-apply-button"
              onClick={() => ws.applyStyleDnaToProject(selected)}
              className="rounded-2xl bg-emerald-300 px-4 py-2 text-sm font-bold text-black hover:bg-emerald-200"
            >
              Apply to Suno project
            </button>
            <button
              type="button"
              onClick={() => ws.copyToClipboard(selected.styleTokens, "Style DNA tokens copied")}
              className="rounded-2xl border border-white/15 bg-black/30 px-4 py-2 text-sm font-bold text-white hover:bg-white/10"
            >
              Copy style tokens
            </button>
          </>
        )}
      </div>

      {error && (
        <p className="mt-3 rounded-xl border border-red-400/30 bg-red-950/30 px-3 py-2 text-xs text-red-100">
          {error}
        </p>
      )}

      {results.length > 0 && (
        <div className="mt-4 space-y-3" data-testid="style-dna-results">
          <div className="text-[10px] uppercase tracking-wider text-white/40">
            {results.length} result(s) · {provider}
          </div>
          <div className="flex flex-col gap-2">
            {results.map((hit, idx) => (
              <button
                key={`${hit.source}-${hit.id}-${idx}`}
                type="button"
                onClick={() => setSelectedIdx(idx)}
                className={
                  "rounded-2xl border p-3 text-left transition " +
                  (idx === selectedIdx
                    ? "border-indigo-300/50 bg-indigo-500/15"
                    : "border-white/10 bg-black/20 hover:border-white/20")
                }
              >
                <div className="text-sm font-bold text-indigo-100">
                  {hit.artist} — {hit.title}
                </div>
                {hit.album && <div className="text-[11px] text-white/45">{hit.album}</div>}
                <div className="mt-1 text-[11px] text-white/55">
                  {hit.tempo || "tempo ?"}
                  {hit.estimatedKey ? ` · ${hit.estimatedKey}` : ""}
                  {hit.genres?.length ? ` · ${hit.genres.join(", ")}` : ""}
                </div>
              </button>
            ))}
          </div>

          {selected && (
            <div className="rounded-2xl border border-emerald-400/25 bg-emerald-950/20 p-3">
              <div className="mb-2 text-xs font-bold uppercase tracking-wider text-emerald-200/80">
                Suno style tokens
              </div>
              <pre
                data-testid="style-dna-token-preview"
                className="max-h-40 overflow-auto whitespace-pre-wrap rounded-xl bg-black/40 p-3 text-[11px] leading-relaxed text-emerald-50"
              >
                {selected.styleTokens}
              </pre>
              {selected.featureSummary && (
                <p className="mt-2 text-[10px] text-white/45">Features: {selected.featureSummary}</p>
              )}
            </div>
          )}
        </div>
      )}
    </Panel>
  );
});
