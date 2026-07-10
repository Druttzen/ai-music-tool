/**
 * Online artist voice-style lookup — MusicBrainz + Wikipedia (+ optional Spotify genres).
 * Fetches real public metadata; maps to Suno 5.5 vocal tokens via voice-style-mapper.
 */

import { searchMusicBrainzArtists, fetchMusicBrainzArtist } from "./musicbrainz-artist";
import { searchSpotifyArtists } from "./spotify-style-dna";
import { isSpotifyStyleDnaReady } from "./style-dna-settings";
import { buildSunoVoiceStyleFromProfile } from "./voice-style-mapper";

/**
 * @typedef {object} ArtistVoiceProfile
 * @property {string} id
 * @property {string} displayName
 * @property {string} sortName
 * @property {string} gender
 * @property {string} type
 * @property {string} country
 * @property {string[]} tags
 * @property {string[]} genres
 * @property {string[]} spotifyGenres
 * @property {string} wikipediaTitle
 * @property {string} wikipediaDescription
 * @property {string} wikipediaExtract
 * @property {string} externalUrl
 * @property {string[]} sources
 * @property {string} [disambiguation]
 */

/**
 * @param {string} title
 */
export async function fetchWikipediaSummary(title) {
  const slug = encodeURIComponent(String(title || "").trim().replace(/\s+/g, "_"));
  if (!slug) return null;

  const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${slug}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (data?.type === "disambiguation") return null;
  return {
    title: data?.title || title,
    description: data?.description || "",
    extract: data?.extract || "",
    url: data?.content_urls?.desktop?.page || "",
  };
}

/**
 * @param {object} hit
 * @param {object} [extras]
 * @returns {ArtistVoiceProfile}
 */
export function normalizeArtistVoiceProfile(hit, extras = {}) {
  return {
    id: hit.id || "",
    displayName: hit.name || "",
    sortName: hit.sortName || hit.name || "",
    gender: hit.gender || "",
    type: hit.type || "",
    country: hit.country || "",
    tags: hit.tags || [],
    genres: hit.genres || [],
    spotifyGenres: extras.spotifyGenres || [],
    wikipediaTitle: extras.wikipediaTitle || "",
    wikipediaDescription: extras.wikipediaDescription || "",
    wikipediaExtract: extras.wikipediaExtract || "",
    externalUrl: hit.externalUrl || extras.wikipediaUrl || "",
    sources: uniqSources([...(hit.sources || []), ...(extras.sources || [])]),
    disambiguation: hit.disambiguation || "",
  };
}

/**
 * @param {string[]} sources
 */
function uniqSources(sources) {
  return [...new Set(sources.filter(Boolean))];
}

/**
 * @param {string} query
 * @param {number} [limit]
 */
export async function searchArtistVoiceCandidates(query, limit = 6) {
  const q = String(query || "").trim();
  if (!q) return [];
  const artists = await searchMusicBrainzArtists(q, limit);
  return artists.map((a) => normalizeArtistVoiceProfile(a));
}

/**
 * @param {string} mbid
 * @param {import("./style-dna-settings").DEFAULT_STYLE_DNA_SETTINGS} [styleDnaSettings]
 */
export async function fetchArtistVoiceProfile(mbid, styleDnaSettings) {
  const artist = await fetchMusicBrainzArtist(mbid);
  if (!artist) return null;

  const wiki = await fetchWikipediaSummary(artist.name);
  /** @type {string[]} */
  let spotifyGenres = [];
  const sources = ["musicbrainz"];

  if (styleDnaSettings && isSpotifyStyleDnaReady(styleDnaSettings)) {
    try {
      const spotifyHits = await searchSpotifyArtists(
        artist.name,
        styleDnaSettings.spotifyClientId,
        styleDnaSettings.spotifyClientSecret,
        1,
      );
      spotifyGenres = spotifyHits[0]?.genres || [];
      if (spotifyGenres.length) sources.push("spotify");
    } catch {
      /* optional enrichment */
    }
  }

  if (wiki) sources.push("wikipedia");

  return normalizeArtistVoiceProfile(artist, {
    spotifyGenres,
    wikipediaTitle: wiki?.title || "",
    wikipediaDescription: wiki?.description || "",
    wikipediaExtract: wiki?.extract || "",
    wikipediaUrl: wiki?.url || "",
    sources,
  });
}

/**
 * @param {string} query
 * @param {import("./style-dna-settings").DEFAULT_STYLE_DNA_SETTINGS} [styleDnaSettings]
 */
export async function lookupArtistVoiceProfile(query, styleDnaSettings) {
  const candidates = await searchArtistVoiceCandidates(query, 1);
  const top = candidates[0];
  if (!top?.id) return null;
  return fetchArtistVoiceProfile(top.id, styleDnaSettings);
}

/**
 * @param {ArtistVoiceProfile} profile
 * @param {{ selectedGenres?: string[], referenceName?: string }} [ctx]
 */
export function buildVoiceStyleFromProfile(profile, ctx = {}) {
  return buildSunoVoiceStyleFromProfile(profile, ctx);
}
