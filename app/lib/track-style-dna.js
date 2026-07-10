/**
 * Track Style-DNA — map Spotify features / MusicBrainz tags to Suno project fields.
 */

import { clamp, uniq } from "./music-helpers";
import { resolveCatalogTags } from "./analyzer-suggestions";
import { genreOptions, rhythmOptions, soundOptions } from "./suno-music-styles";
import {
  applyMoodPatch,
  mergeAnalyzerRuleLine,
  mergeGuidedGenres,
  mergeGuidedRhythms,
  mergeGuidedSounds,
  stripAnalyzerRuleLine,
  truncateAnalyzerRuleLine,
} from "./analyzer-guided-merge";
import { searchMusicBrainzStyleDnaHits } from "./musicbrainz-style-dna";
import {
  fetchSpotifyStyleDnaHit,
  parseSpotifyTrackUrl,
  searchSpotifyStyleDnaHits,
} from "./spotify-style-dna";
import { parseYoutubeReference, resolveYoutubeReference } from "./youtube-reference";
import { resolveYoutubeMusicDna } from "./youtube-music-dna";
import { enrichStyleDnaHit } from "./style-dna-enrich";
import { isSpotifyStyleDnaReady } from "./style-dna-settings";

const KEY_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

/**
 * @param {number|null} pitchClass
 * @param {number|null} mode 1 = major, 0 = minor
 */
export function formatSpotifyKey(pitchClass, mode) {
  if (pitchClass == null || pitchClass < 0 || pitchClass > 11) return "";
  const name = KEY_NAMES[pitchClass] || "";
  if (!name) return "";
  return `${name} ${mode === 1 ? "major" : mode === 0 ? "minor" : ""}`.trim();
}

/**
 * @param {object|null} features
 */
export function mapSpotifyFeaturesToMood(features) {
  if (!features) return null;
  const energy = clamp(Math.round((features.energy ?? 0.5) * 100));
  const valencePct = clamp(Math.round((features.valence ?? 0.5) * 100));
  const dancePct = clamp(Math.round((features.danceability ?? 0.5) * 100));
  const acoustic = features.acousticness ?? 0;

  return {
    energy,
    aggression: clamp(Math.round(energy * 0.55 + (features.liveness ?? 0) * 40)),
    darkness: clamp(Math.round((100 - valencePct) * 0.7 + (100 - dancePct) * 0.2)),
    emotion: valencePct,
    complexity: clamp(Math.round((features.speechiness ?? 0) * 40 + (features.instrumentalness ?? 0) * 30 + 35)),
    space: clamp(Math.round((1 - acoustic) * 55 + 45)),
  };
}

/**
 * @param {object|null} features
 */
export function inferSoundsFromSpotifyFeatures(features) {
  if (!features) return [];
  const sounds = [];
  if (features.acousticness > 0.55) sounds.push("Acoustic guitar", "Piano");
  if (features.acousticness < 0.25 && features.energy > 0.55) {
    sounds.push("Analog synths", "Heavy sub bass");
  }
  if (features.instrumentalness > 0.65) sounds.push("Atmospheric pads");
  if (features.speechiness > 0.35) sounds.push("Vocal samples");
  if (features.liveness > 0.65) sounds.push("Live drums");
  if (features.valence < 0.35) sounds.push("Dark pads");
  if (features.valence > 0.7) sounds.push("Bright leads");
  return uniq(sounds);
}

/**
 * @param {object|null} features
 */
export function inferRhythmsFromSpotifyFeatures(features) {
  if (!features) return [];
  const rhythms = [];
  const tempo = features.tempo || 120;
  if (features.time_signature === 3) rhythms.push("Waltz");
  else rhythms.push("4/4");
  if (features.danceability > 0.72) rhythms.push("Syncopated");
  if (tempo >= 140 && features.energy > 0.6) rhythms.push("Rolling");
  if (tempo < 95) rhythms.push("Halftime");
  return uniq(rhythms);
}

/**
 * @param {object|null} features
 */
export function inferVocalFromSpotifyFeatures(features) {
  if (!features) return null;
  if (features.instrumentalness >= 0.85) return "Instrumental";
  if (features.speechiness > 0.45) return "Rap";
  return null;
}

/**
 * @param {string[]} rawGenres
 */
export function mapGenresToCatalog(rawGenres) {
  return resolveCatalogTags(rawGenres, genreOptions);
}

/**
 * @param {object} hit
 */
export function buildStyleDnaFromHit(hit) {
  const features = hit.features;
  const rawGenres = uniq([...(hit.artistGenres || []), ...(hit.tags || [])]);
  const genres = mapGenresToCatalog(rawGenres);
  const sounds = resolveCatalogTags(inferSoundsFromSpotifyFeatures(features), soundOptions);
  const rhythms = resolveCatalogTags(inferRhythmsFromSpotifyFeatures(features), rhythmOptions);
  const mood = mapSpotifyFeaturesToMood(features);
  const tempo =
    features?.tempo != null
      ? `${Math.round(features.tempo)} BPM`
      : hit.lengthMs
        ? `${Math.max(70, Math.min(180, Math.round(60000 / Math.max(hit.lengthMs / 4, 1))))} BPM est`
        : "";
  const estimatedKey = features ? formatSpotifyKey(features.key, features.mode) : "";
  const vocalRole = inferVocalFromSpotifyFeatures(features);

  const moodWords = [];
  if (mood) {
    if (mood.energy > 65) moodWords.push("high-energy");
    if (mood.darkness > 60) moodWords.push("dark");
    if (mood.emotion > 65) moodWords.push("uplifting");
    if (mood.emotion < 35) moodWords.push("melancholic");
    if (features?.danceability > 0.7) moodWords.push("danceable");
    if (features?.acousticness > 0.5) moodWords.push("acoustic");
  }

  const featureSummary = features
    ? [
        features.danceability != null ? `dance ${features.danceability.toFixed(2)}` : "",
        features.energy != null ? `energy ${features.energy.toFixed(2)}` : "",
        features.valence != null ? `valence ${features.valence.toFixed(2)}` : "",
        features.acousticness != null ? `acoustic ${features.acousticness.toFixed(2)}` : "",
      ]
        .filter(Boolean)
        .join(", ")
    : rawGenres.slice(0, 4).join(", ");

  return {
    source: hit.source,
    id: hit.id,
    title: hit.title,
    artist: hit.artist,
    album: hit.album || "",
    externalUrl: hit.externalUrl || "",
    tempo,
    estimatedKey,
    genres,
    sounds,
    rhythms,
    mood,
    moodWords: uniq(moodWords),
    vocalRole,
    featureSummary,
    styleTokens: buildStyleDnaStyleTokens({
      title: hit.title,
      artist: hit.artist,
      genres,
      sounds,
      rhythms,
      tempo,
      estimatedKey,
      moodWords,
      featureSummary,
    }),
  };
}

/**
 * @param {object} dna
 */
export function buildStyleDnaStyleTokens(dna) {
  const tokens = uniq([
    ...dna.genres,
    ...dna.moodWords,
    dna.tempo,
    dna.estimatedKey,
    ...dna.sounds.slice(0, 4),
    ...dna.rhythms.slice(0, 2),
    dna.featureSummary,
  ]).filter(Boolean);
  return tokens.join(", ");
}

/**
 * @param {object} dna
 */
export function compactStyleDnaRule(dna) {
  const parts = [
    `${dna.artist} — ${dna.title}`,
    dna.tempo || "",
    dna.estimatedKey || "",
    dna.featureSummary ? `FX:${dna.featureSummary}` : "",
    dna.genres.length ? `G:${dna.genres.slice(0, 2).join("+")}` : "",
    dna.sounds.length ? dna.sounds.slice(0, 4).join(",") : "",
  ].filter(Boolean);
  return truncateAnalyzerRuleLine(`REF: ${parts.join(" │ ")}`);
}

/**
 * @param {string} prev
 * @param {object} dna
 */
export function mergeStyleDnaIntoIdea(prev, dna) {
  const add = `Reference track: ${dna.artist} — ${dna.title}${dna.album ? ` (${dna.album})` : ""}`;
  const p = (prev || "").trim();
  if (!p) return add;
  if (/reference track:/i.test(p)) return p;
  if (p.length < 120) return `${p}. ${add}`;
  return p;
}

/**
 * @param {object} dna
 */
export function buildStyleDnaPatch(dna) {
  /** @type {Record<string, unknown>} */
  const patch = {
    rules: (prev) => mergeAnalyzerRuleLine(prev, "ref", compactStyleDnaRule(dna)),
    idea: (prev) => mergeStyleDnaIntoIdea(prev, dna),
  };

  if (dna.tempo) patch.tempo = dna.tempo;
  if (dna.genres?.length) {
    patch.selectedGenres = (prev) => mergeGuidedGenres(prev, dna.genres);
  }
  if (dna.sounds?.length) {
    patch.selectedSounds = (prev) => mergeGuidedSounds(prev, dna.sounds);
  }
  if (dna.rhythms?.length) {
    patch.selectedRhythms = (prev) => mergeGuidedRhythms(prev, dna.rhythms);
  }
  if (dna.mood) {
    patch.mood = (prev) => applyMoodPatch(prev, dna.mood);
  }
  if (dna.vocalRole) {
    patch.vocal = dna.vocalRole;
  }

  return patch;
}

/**
 * @param {string} rules
 */
export function stripStyleDnaRuleLine(rules) {
  return stripAnalyzerRuleLine(rules, "ref");
}

/**
 * @param {string} input
 * @param {{ spotifyClientId?: string, spotifyClientSecret?: string }} settings
 */
export async function searchTrackStyleDna(input, settings) {
  const query = String(input || "").trim();
  if (!query) throw new Error("Enter artist/title, Spotify track URL, or YouTube URL");

  const spotifyReady = isSpotifyStyleDnaReady(settings);
  const spotifyId = parseSpotifyTrackUrl(query);

  if (spotifyId && spotifyReady) {
    const hit = await fetchSpotifyStyleDnaHit(
      spotifyId,
      settings.spotifyClientId,
      settings.spotifyClientSecret,
    );
    const dna = await enrichStyleDnaHit(hit, null, settings);
    return {
      hits: [hit],
      mapped: [dna],
      provider: "spotify",
    };
  }

  const yt = parseYoutubeReference(query);
  if (yt?.watchUrl) {
    const bundle = await resolveYoutubeMusicDna(query, settings);
    return {
      hits: bundle.hits,
      mapped: [bundle.dna],
      provider: bundle.provider,
      resolvedQuery: bundle.youtube.searchQuery || bundle.youtube.title,
      youtube: bundle.youtube,
      replication: bundle.replication,
    };
  }

  if (spotifyReady) {
    try {
      const hits = await searchSpotifyStyleDnaHits(
        query,
        settings.spotifyClientId,
        settings.spotifyClientSecret,
      );
      if (hits.length) {
        const mapped = await Promise.all(
          hits.map((hit) => enrichStyleDnaHit(hit, null, settings)),
        );
        return {
          hits,
          mapped,
          provider: "spotify",
        };
      }
    } catch {
      /* fall through to MusicBrainz */
    }
  }

  const mbHits = await searchMusicBrainzStyleDnaHits(query);
  if (!mbHits.length) throw new Error("No tracks found — try a different query");
  const mapped = await Promise.all(mbHits.map((hit) => enrichStyleDnaHit(hit, null, settings)));
  return {
    hits: mbHits,
    mapped,
    provider: "musicbrainz",
  };
}
