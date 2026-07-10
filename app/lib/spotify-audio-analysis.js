/**
 * Spotify audio-analysis — sections, bars, beats for structure hints.
 */

import { getSpotifyAccessToken } from "./spotify-style-dna";

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
 * @param {string} trackId
 * @param {string} clientId
 * @param {string} clientSecret
 */
export async function fetchSpotifyAudioAnalysis(trackId, clientId, clientSecret) {
  const id = String(trackId || "").trim();
  if (!id) return null;
  const token = await getSpotifyAccessToken(clientId, clientSecret);
  try {
    return await spotifyGet(`/audio-analysis/${id}`, token);
  } catch {
    return null;
  }
}

/**
 * @param {object|null} analysis
 */
export function summarizeSpotifySections(analysis) {
  if (!analysis?.sections?.length) return null;
  const sections = analysis.sections.slice(0, 16).map((s, i) => ({
    index: i,
    startSec: Math.round((s.start || 0) * 10) / 10,
    durationSec: Math.round((s.duration || 0) * 10) / 10,
    loudness: s.loudness,
    tempo: s.tempo,
    key: s.key,
    mode: s.mode,
    confidence: s.confidence,
  }));
  const labels = inferSectionLabels(sections);
  return {
    sections,
    labels,
    tempo: analysis.track?.tempo,
    key: analysis.track?.key,
    mode: analysis.track?.mode,
    timeSignature: analysis.track?.time_signature,
  };
}

/**
 * @param {object[]} sections
 */
function inferSectionLabels(sections) {
  if (!sections.length) return [];
  const loudnesses = sections.map((s) => s.loudness ?? -20);
  const maxL = Math.max(...loudnesses);
  const minL = Math.min(...loudnesses);
  const span = maxL - minL || 1;
  return sections.map((s, i) => {
    if (i === 0) return "intro";
    if (i === sections.length - 1) return "outro";
    const norm = ((s.loudness ?? -20) - minL) / span;
    if (norm > 0.75) return "chorus";
    if (norm < 0.35) return "verse";
    return "bridge";
  });
}

/**
 * @param {object|null} summary
 */
export function structureLineFromSpotifySections(summary) {
  if (!summary?.labels?.length) return "";
  const uniq = [];
  for (const label of summary.labels) {
    if (uniq[uniq.length - 1] !== label) uniq.push(label);
  }
  return uniq.join(" → ");
}
