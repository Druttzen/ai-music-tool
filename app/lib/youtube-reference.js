/**
 * Parse YouTube URLs and resolve public metadata (sidecar-first — browser oEmbed is CORS-blocked).
 */

import { resolveYoutubeViaSidecar, waitForSidecar } from "./sidecar-bridge";

/**
 * @param {string} url
 * @returns {{ videoId: string, watchUrl: string } | null}
 */
export function parseYoutubeReference(url) {
  const raw = String(url || "").trim();
  if (!raw) return null;

  const patterns = [
    /(?:youtube\.com\/watch\?[^#]*v=|youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/live\/)([\w-]{11})/i,
    /[?&]v=([\w-]{11})/i,
  ];

  for (const re of patterns) {
    const m = raw.match(re);
    if (m?.[1]) {
      const videoId = m[1];
      return { videoId, watchUrl: `https://www.youtube.com/watch?v=${videoId}` };
    }
  }
  return null;
}

/**
 * Browser oEmbed — usually blocked by CORS; kept as last resort.
 * @param {string} watchUrl
 */
export async function fetchYoutubeTitle(watchUrl) {
  try {
    const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`;
    const res = await fetch(endpoint);
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.title === "string" ? data.title : null;
  } catch {
    return null;
  }
}

/**
 * @param {object} payload
 */
export function normalizeYoutubeResolvePayload(payload) {
  if (!payload || typeof payload !== "object") return null;
  const videoId = String(payload.video_id || payload.videoId || "").trim();
  const watchUrl =
    String(payload.watch_url || payload.watchUrl || "").trim() ||
    (videoId ? `https://www.youtube.com/watch?v=${videoId}` : "");
  if (!videoId || !watchUrl) return null;

  return {
    videoId,
    watchUrl,
    title: String(payload.title || videoId).trim(),
    authorName: String(payload.author_name || payload.authorName || "").trim(),
    thumbnailUrl: String(payload.thumbnail_url || payload.thumbnailUrl || "").trim(),
    durationSec:
      typeof payload.duration_sec === "number"
        ? payload.duration_sec
        : typeof payload.durationSec === "number"
          ? payload.durationSec
          : null,
    parsedArtist: String(payload.parsed_artist || payload.parsedArtist || "").trim(),
    parsedTrack: String(payload.parsed_track || payload.parsedTrack || "").trim(),
    searchQuery: String(payload.search_query || payload.searchQuery || payload.title || "").trim(),
    tags: Array.isArray(payload.tags) ? payload.tags.map(String) : [],
    categories: Array.isArray(payload.categories) ? payload.categories.map(String) : [],
    descriptionExcerpt: String(payload.description_excerpt || payload.descriptionExcerpt || "").trim(),
    provider: String(payload.provider || "sidecar"),
  };
}

/**
 * Resolve YouTube metadata via local sidecar (no CORS), with title-only browser fallback.
 * @param {string} url
 */
export async function resolveYoutubeReference(url) {
  const ref = parseYoutubeReference(url);
  if (!ref) return null;

  const ready = await waitForSidecar(8_000);
  if (ready) {
    try {
      const payload = await resolveYoutubeViaSidecar(ref.watchUrl);
      const normalized = normalizeYoutubeResolvePayload(payload);
      if (normalized) return normalized;
    } catch {
      /* fall through */
    }
  }

  const title = await fetchYoutubeTitle(ref.watchUrl);
  return {
    videoId: ref.videoId,
    watchUrl: ref.watchUrl,
    title: title || ref.videoId,
    authorName: "",
    thumbnailUrl: "",
    durationSec: null,
    parsedArtist: "",
    parsedTrack: title || "",
    searchQuery: title || ref.videoId,
    tags: [],
    categories: [],
    descriptionExcerpt: "",
    provider: title ? "oembed" : "fallback",
  };
}
