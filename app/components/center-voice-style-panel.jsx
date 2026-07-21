"use client";

import { memo, useCallback, useState } from "react";
import { Panel, Pill } from "./ui-blocks";
import {
  FAMOUS_VOICE_PRESETS,
  formatPublicName,
  presetToVoiceProfile,
} from "../lib/suno-voice-style";
import {
  useProjectWorkspaceActions,
  useProjectWorkspaceProjectState,
  useProjectWorkspacePromptState,
} from "../context/project-workspace-context";
import { useWorkspaceResetEffect } from "../hooks/use-workspace-reset-effect";
import { searchArtistVoiceCandidates } from "../lib/voice-style-lookup";
import { buildSunoVoiceStyleFromProfile, summarizeArtistVoiceProfile } from "../lib/voice-style-mapper";
import { isSpotifyStyleDnaReady } from "../lib/style-dna-settings";

export const CenterVoiceStylePanel = memo(function CenterVoiceStylePanel() {
  const { vocal, voiceRefFirstName, voiceRefLastName, styleDnaSettings } =
    useProjectWorkspaceProjectState();
  const { voiceStyleCompact } = useProjectWorkspacePromptState();
  const {
    setVoiceRefFirstName,
    setVoiceRefLastName,
    setVoiceStyleLine,
    setStatusWithTime,
    generateVoiceStyleFromNames,
    generateVoiceStyleFromPreset,
    generateVoiceStyleFromArtistId,
    copyToClipboard,
  } = useProjectWorkspaceActions();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchResults, setSearchResults] = useState(/** @type {Array<object>} */ ([]));
  const [lastSources, setLastSources] = useState(/** @type {string[]} */ ([]));

  useWorkspaceResetEffect(() => {
    setSearchQuery("");
    setSearchBusy(false);
    setSearchError("");
    setSearchResults([]);
    setLastSources([]);
  });

  const spotifyReady = isSpotifyStyleDnaReady(styleDnaSettings);

  const runArtistSearch = useCallback(async () => {
    const q = searchQuery.trim() || formatPublicName(voiceRefFirstName, voiceRefLastName).trim();
    if (!q) {
      setStatusWithTime("Enter a name to search", "warning");
      return;
    }
    setSearchError("");
    setSearchBusy(true);
    try {
      const hits = await searchArtistVoiceCandidates(q, 6);
      setSearchResults(hits);
      setStatusWithTime(
        hits.length
          ? `Found ${hits.length} artist match(es) on MusicBrainz`
          : "No MusicBrainz artist matches",
        hits.length ? "success" : "warning",
      );
    } catch (err) {
      setSearchResults([]);
      setSearchError(err instanceof Error ? err.message : "Search failed");
      setStatusWithTime("Artist search failed", "error");
    } finally {
      setSearchBusy(false);
    }
  }, [searchQuery, setStatusWithTime, voiceRefFirstName, voiceRefLastName]);

  const applySearchHit = useCallback(
    async (hit) => {
      const parts = String(hit.displayName || "").split(/\s+/);
      setVoiceRefFirstName(parts[0] || "");
      setVoiceRefLastName(parts.slice(1).join(" "));
      const built = await generateVoiceStyleFromArtistId(hit.id, hit.displayName);
      if (built?.sources) setLastSources(built.sources);
    },
    [generateVoiceStyleFromArtistId, setVoiceRefFirstName, setVoiceRefLastName],
  );

  const previewPresetTraits = useCallback((preset) => {
    const profile = presetToVoiceProfile(preset);
    return buildSunoVoiceStyleFromProfile(profile, {
      referenceName: formatPublicName(preset.first, preset.last),
    }).traitSummary;
  }, []);

  return (
    <Panel
      title="Suno Voice Style Generator"
      hint="Search MusicBrainz (+ Wikipedia, optional Spotify genres) for real artist metadata, then map to Suno 5.5 vocal tokens — stylistic reference only."
      data-testid="voice-style-panel"
    >
      <p className="mb-3 text-xs text-white/50">
        Suno 5.5 works best with Character + Delivery + Effects tokens (not just a celebrity name).
        Search loads public genre/gender/wiki data; presets use curated MusicBrainz tag seeds offline.
      </p>

      <div className="mb-3 rounded-2xl border border-sky-400/20 bg-sky-950/20 p-3">
        <div className="mb-2 text-xs font-bold uppercase tracking-wider text-sky-200/80">
          Search famous artist (online)
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            data-testid="voice-style-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void runArtistSearch();
            }}
            placeholder='e.g. "Adele" or "Freddie Mercury"'
            className="min-w-[12rem] flex-1 rounded-2xl border border-white/10 bg-black/30 p-3 text-sm text-white outline-none focus:border-cyan-300"
          />
          <button
            type="button"
            data-testid="voice-style-search-btn"
            disabled={searchBusy}
            onClick={() => void runArtistSearch()}
            className="rounded-2xl bg-sky-400 px-4 py-2 text-sm font-bold text-black hover:bg-sky-300 disabled:opacity-50"
          >
            {searchBusy ? "Searching…" : "Search MusicBrainz"}
          </button>
        </div>
        {spotifyReady ? (
          <p className="mt-2 text-[10px] text-emerald-200/70">
            Spotify credentials detected — artist genres enrich voice tokens when you pick a result.
          </p>
        ) : (
          <p className="mt-2 text-[10px] text-white/40">
            Add Spotify API keys in Style-DNA Search for richer genre tokens (optional).
          </p>
        )}
        {searchError ? (
          <p className="mt-2 text-[11px] text-red-300">{searchError}</p>
        ) : null}
        {searchResults.length > 0 ? (
          <ul className="mt-3 space-y-2" data-testid="voice-style-search-results">
            {searchResults.map((hit) => (
              <li key={hit.id}>
                <button
                  type="button"
                  onClick={() => void applySearchHit(hit)}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-left hover:border-cyan-300/40 hover:bg-black/50"
                >
                  <div className="text-sm font-bold text-white">{hit.displayName}</div>
                  <div className="text-[10px] text-white/45">
                    {summarizeArtistVoiceProfile(hit)}
                    {hit.disambiguation ? ` · ${hit.disambiguation}` : ""}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label>
          <div className="mb-1 text-xs font-bold uppercase tracking-wider text-white/45">First name</div>
          <input
            value={voiceRefFirstName}
            onChange={(e) => setVoiceRefFirstName(e.target.value)}
            placeholder="e.g. Freddie"
            className="w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-white outline-none focus:border-cyan-300"
          />
        </label>
        <label>
          <div className="mb-1 text-xs font-bold uppercase tracking-wider text-white/45">Last name</div>
          <input
            value={voiceRefLastName}
            onChange={(e) => setVoiceRefLastName(e.target.value)}
            placeholder="e.g. Mercury (optional)"
            className="w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-white outline-none focus:border-cyan-300"
          />
        </label>
      </div>

      <div className="mt-3">
        <div className="mb-2 text-xs font-bold uppercase tracking-wider text-white/45">
          Quick presets (MusicBrainz tag seeds)
        </div>
        <div className="flex flex-wrap gap-2">
          {FAMOUS_VOICE_PRESETS.map((p, presetIdx) => {
            const label = formatPublicName(p.first, p.last);
            const traits = previewPresetTraits(p);
            return (
              <Pill
                key={`voice-preset-${presetIdx}-${p.first}-${p.last}`}
                active={false}
                title={traits}
                onClick={() => {
                  setVoiceRefFirstName(p.first);
                  setVoiceRefLastName(p.last);
                  void generateVoiceStyleFromPreset(p);
                  setLastSources(p.profileSeed?.sources || ["musicbrainz-seed"]);
                  setStatusWithTime(`Preset: ${label} — ${traits.slice(0, 80)}…`);
                }}
              >
                {label}
              </Pill>
            );
          })}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="generate-voice-style-btn"
          onClick={() => void generateVoiceStyleFromNames()}
          className="rounded-2xl bg-cyan-300 px-4 py-2 text-sm font-bold text-black hover:bg-cyan-200"
        >
          Generate voice style (online lookup)
        </button>
        <button
          type="button"
          onClick={() => {
            setVoiceRefFirstName("");
            setVoiceRefLastName("");
            setVoiceStyleLine("");
            setSearchResults([]);
            setLastSources([]);
            setStatusWithTime("Voice style cleared");
          }}
          className="rounded-2xl border border-white/15 bg-black/30 px-4 py-2 text-sm font-bold text-white hover:bg-white/10"
        >
          Clear
        </button>
      </div>

      {lastSources.length > 0 ? (
        <p className="mt-2 text-[10px] text-cyan-200/70" data-testid="voice-style-sources">
          Data sources: {lastSources.join(", ")}
        </p>
      ) : null}

      {vocal === "Instrumental" && (
        <div className="mt-3 rounded-2xl border border-amber-300/25 bg-amber-300/10 p-3 text-xs text-amber-100">
          Instrumental mode: voice reference is not added to the Suno-like export. Switch vocal preset to hear a lead
          vocal in the prompt.
        </div>
      )}
      {voiceStyleCompact.style ? (
        <div className="mt-3 space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-white/45">Style box (Suno 5.5)</div>
          <pre
            data-testid="voice-style-output"
            className="max-h-24 overflow-auto whitespace-pre-wrap rounded-2xl border border-cyan-300/20 bg-black/50 p-3 text-[11px] text-cyan-50"
          >
            {voiceStyleCompact.style}
          </pre>
          <button
            type="button"
            onClick={() => copyToClipboard(voiceStyleCompact.style, "Voice style copied")}
            className="w-full rounded-2xl bg-cyan-300 px-4 py-2 text-sm font-bold text-black hover:bg-cyan-200"
          >
            Copy style line
          </button>
          <div className="text-xs font-bold uppercase tracking-wider text-white/45">Lyric metatag</div>
          <pre className="max-h-20 overflow-auto whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/40 p-3 text-[11px] text-white/80">
            {voiceStyleCompact.lyricTag}
          </pre>
          <button
            type="button"
            onClick={() => copyToClipboard(voiceStyleCompact.lyricTag, "Lyric metatag copied")}
            className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/20"
          >
            Copy lyric metatag
          </button>
        </div>
      ) : null}
    </Panel>
  );
});
