/**
 * Spotify Web API — track search + audio features for Style DNA (client credentials).
 */

/** @type {{ token: string, expiresAt: number } | null} */
let tokenCache = null;

/**
 * @param {string} url
 */
export function parseSpotifyTrackUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return null;

  const patterns = [
    /open\.spotify\.com\/track\/([a-zA-Z0-9]{22})/i,
    /spotify:track:([a-zA-Z0-9]{22})/i,
  ];

  for (const re of patterns) {
    const m = raw.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

/**
 * @param {string} clientId
 * @param {string} clientSecret
 */
export async function getSpotifyAccessToken(clientId, clientSecret) {
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.token;
  }

  const body = new URLSearchParams({ grant_type: "client_credentials" });
  const auth =
    typeof btoa === "function"
      ? btoa(`${clientId}:${clientSecret}`)
      : Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${auth}`,
    },
    body,
  });

  if (!res.ok) {
    throw new Error(`Spotify auth failed (${res.status}) — check Client ID and Secret`);
  }

  const data = await res.json();
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000,
  };
  return tokenCache.token;
}

/**
 * @param {string} path
 * @param {string} token
 */
async function spotifyGet(path, token) {
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Spotify API error (${res.status})`);
  }
  return res.json();
}

/**
 * @param {string} query
 * @param {string} clientId
 * @param {string} clientSecret
 * @param {number} [limit]
 */
export async function searchSpotifyTracks(query, clientId, clientSecret, limit = 5) {
  const token = await getSpotifyAccessToken(clientId, clientSecret);
  const q = encodeURIComponent(String(query).trim());
  const data = await spotifyGet(`/search?q=${q}&type=track&limit=${limit}`, token);
  const items = data?.tracks?.items;
  return Array.isArray(items) ? items : [];
}

/**
 * @param {string} trackId
 * @param {string} clientId
 * @param {string} clientSecret
 */
export async function fetchSpotifyTrackBundle(trackId, clientId, clientSecret) {
  const token = await getSpotifyAccessToken(clientId, clientSecret);
  const track = await spotifyGet(`/tracks/${trackId}`, token);
  const artistId = track?.artists?.[0]?.id;
  const [features, artist] = await Promise.all([
    spotifyGet(`/audio-features/${trackId}`, token),
    artistId ? spotifyGet(`/artists/${artistId}`, token) : Promise.resolve(null),
  ]);
  return { track, features, artist };
}

/**
 * @param {object} track
 * @param {object|null} features
 * @param {object|null} artist
 */
export function normalizeSpotifyTrackHit(track, features, artist) {
  const artistName = track?.artists?.map((a) => a.name).filter(Boolean).join(", ") || "Unknown artist";
  const title = track?.name || "Unknown track";
  return {
    source: "spotify",
    id: track?.id || "",
    title,
    artist: artistName,
    album: track?.album?.name || "",
    releaseDate: track?.album?.release_date || "",
    previewUrl: track?.preview_url || "",
    externalUrl: track?.external_urls?.spotify || "",
    artistGenres: Array.isArray(artist?.genres) ? artist.genres : [],
    features: features || null,
  };
}

/**
 * @param {string} query
 * @param {string} clientId
 * @param {string} clientSecret
 * @param {number} [limit]
 */
export async function searchSpotifyArtists(query, clientId, clientSecret, limit = 3) {
  const token = await getSpotifyAccessToken(clientId, clientSecret);
  const q = encodeURIComponent(String(query).trim());
  const data = await spotifyGet(`/search?q=${q}&type=artist&limit=${limit}`, token);
  const items = data?.artists?.items;
  if (!Array.isArray(items)) return [];
  return items.map((artist) => ({
    id: artist?.id || "",
    name: artist?.name || "",
    genres: Array.isArray(artist?.genres) ? artist.genres : [],
    externalUrl: artist?.external_urls?.spotify || "",
  }));
}

/**
 * @param {string} query
 * @param {string} clientId
 * @param {string} clientSecret
 */
export async function searchSpotifyStyleDnaHits(query, clientId, clientSecret) {
  const tracks = await searchSpotifyTracks(query, clientId, clientSecret, 5);
  if (!tracks.length) return [];

  const token = await getSpotifyAccessToken(clientId, clientSecret);
  const hits = await Promise.all(
    tracks.map(async (track) => {
      const artistId = track?.artists?.[0]?.id;
      const [features, artist] = await Promise.all([
        track?.id ? spotifyGet(`/audio-features/${track.id}`, token) : null,
        artistId ? spotifyGet(`/artists/${artistId}`, token) : null,
      ]);
      return normalizeSpotifyTrackHit(track, features, artist);
    }),
  );
  return hits;
}

/**
 * @param {string} trackId
 * @param {string} clientId
 * @param {string} clientSecret
 */
export async function fetchSpotifyStyleDnaHit(trackId, clientId, clientSecret) {
  const { track, features, artist } = await fetchSpotifyTrackBundle(trackId, clientId, clientSecret);
  return normalizeSpotifyTrackHit(track, features, artist);
}
