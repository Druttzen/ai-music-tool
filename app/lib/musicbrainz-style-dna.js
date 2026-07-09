/**
 * MusicBrainz recording search — free fallback when Spotify is not configured.
 */

const MB_USER_AGENT = "AI-Music-Creator/0.11.0 (style-dna-search; contact: local-app)";

/**
 * @param {string} query
 * @param {number} [limit]
 */
export async function searchMusicBrainzRecordings(query, limit = 5) {
  const q = encodeURIComponent(String(query).trim());
  const url = `https://musicbrainz.org/ws/2/recording?query=${q}&fmt=json&limit=${limit}`;

  const res = await fetch(url, {
    headers: { "User-Agent": MB_USER_AGENT, Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`MusicBrainz search failed (${res.status})`);
  }

  const data = await res.json();
  const recordings = data?.recordings;
  return Array.isArray(recordings) ? recordings : [];
}

/**
 * @param {object} recording
 */
export function normalizeMusicBrainzHit(recording) {
  const title = recording?.title || "Unknown track";
  const artist =
    recording?.["artist-credit"]?.map((ac) => ac?.name || ac?.artist?.name).filter(Boolean).join(", ") ||
    "Unknown artist";
  const tags = Array.isArray(recording?.tags)
    ? recording.tags.map((t) => t.name).filter(Boolean)
    : [];
  const release = recording?.releases?.[0];
  const lengthMs = Number(recording?.length) || 0;

  return {
    source: "musicbrainz",
    id: recording?.id || "",
    title,
    artist,
    album: release?.title || "",
    releaseDate: release?.date || "",
    previewUrl: "",
    externalUrl: recording?.id
      ? `https://musicbrainz.org/recording/${recording.id}`
      : "",
    artistGenres: tags,
    features: null,
    lengthMs,
  };
}

/**
 * @param {string} query
 */
export async function searchMusicBrainzStyleDnaHits(query) {
  const recordings = await searchMusicBrainzRecordings(query, 5);
  return recordings.map(normalizeMusicBrainzHit);
}
