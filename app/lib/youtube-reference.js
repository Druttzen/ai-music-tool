/**
 * Parse YouTube URLs for reference metadata (no audio download — user uploads extracted audio).
 */

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
 * Best-effort title fetch via public oEmbed (metadata only).
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
