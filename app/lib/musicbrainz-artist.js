/**
 * MusicBrainz artist search + lookup — genres, tags, gender for voice-style DNA.
 */

const MB_USER_AGENT = "AI-Music-Creator/0.41.0 (voice-style-lookup; contact: local-app)";

/**
 * @param {string} path
 */
async function musicBrainzGet(path) {
  const res = await fetch(`https://musicbrainz.org/ws/2${path}`, {
    headers: { "User-Agent": MB_USER_AGENT, Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`MusicBrainz request failed (${res.status})`);
  }
  return res.json();
}

/**
 * @param {string} query
 * @param {number} [limit]
 */
export async function searchMusicBrainzArtists(query, limit = 5) {
  const q = encodeURIComponent(String(query).trim());
  const data = await musicBrainzGet(`/artist?query=${q}&fmt=json&limit=${limit}`);
  const artists = data?.artists;
  if (!Array.isArray(artists)) return [];
  return artists.map(normalizeMusicBrainzArtistSearchHit);
}

/**
 * @param {string} mbid
 */
export async function fetchMusicBrainzArtist(mbid) {
  const id = String(mbid || "").trim();
  if (!id) return null;
  const data = await musicBrainzGet(`/artist/${id}?inc=tags+genres+aliases&fmt=json`);
  return normalizeMusicBrainzArtistDetail(data);
}

/**
 * @param {object} artist
 */
function normalizeMusicBrainzArtistSearchHit(artist) {
  return {
    id: artist?.id || "",
    name: artist?.name || "Unknown artist",
    sortName: artist?.["sort-name"] || artist?.name || "",
    gender: artist?.gender || "",
    type: artist?.type || "",
    country: artist?.country || "",
    disambiguation: artist?.disambiguation || "",
    tags: [],
    genres: [],
    externalUrl: artist?.id ? `https://musicbrainz.org/artist/${artist.id}` : "",
    sources: ["musicbrainz"],
  };
}

/**
 * @param {object} artist
 */
function normalizeMusicBrainzArtistDetail(artist) {
  const tags = Array.isArray(artist?.tags)
    ? artist.tags.map((t) => t?.name).filter(Boolean)
    : [];
  const genres = Array.isArray(artist?.genres)
    ? artist.genres.map((g) => g?.name).filter(Boolean)
    : [];
  const aliases = Array.isArray(artist?.aliases)
    ? artist.aliases.map((a) => a?.name).filter(Boolean)
    : [];

  return {
    id: artist?.id || "",
    name: artist?.name || "Unknown artist",
    sortName: artist?.["sort-name"] || artist?.name || "",
    gender: artist?.gender || "",
    type: artist?.type || "",
    country: artist?.country || "",
    disambiguation: artist?.disambiguation || "",
    tags: uniqLower([...tags, ...genres]),
    genres: uniqLower(genres.length ? genres : tags),
    aliases,
    externalUrl: artist?.id ? `https://musicbrainz.org/artist/${artist.id}` : "",
    sources: ["musicbrainz"],
  };
}

/**
 * @param {string[]} values
 */
function uniqLower(values) {
  const seen = new Set();
  /** @type {string[]} */
  const out = [];
  for (const v of values) {
    const key = String(v || "").toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(String(v));
  }
  return out;
}
