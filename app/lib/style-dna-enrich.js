/**
 * Enrich Style-DNA hits with AcousticBrainz + Spotify audio-analysis archive layers.
 */

import { fetchAcousticBrainzViaSidecar, fetchYoutubeSonicViaSidecar } from "./sidecar-bridge";
import { fuseStyleDnaWithSonicLayers } from "./sonic-signature-fusion";
import {
  fetchSpotifyAudioAnalysis,
  summarizeSpotifySections,
} from "./spotify-audio-analysis";
import { buildStyleDnaFromHit } from "./track-style-dna";
import { isSpotifyStyleDnaReady } from "./style-dna-settings";

/**
 * @param {object} hit
 * @param {object|null} sonic
 * @param {{ spotifyClientId?: string, spotifyClientSecret?: string }} settings
 */
export async function enrichStyleDnaHit(hit, sonic, settings) {
  /** @type {object|null} */
  let acousticbrainz = null;
  /** @type {object|null} */
  let spotifySections = null;

  if (hit?.source === "musicbrainz" && hit?.id) {
    try {
      acousticbrainz = await fetchAcousticBrainzViaSidecar(hit.id);
    } catch {
      /* optional archive */
    }
  }

  if (hit?.source === "spotify" && hit?.id && isSpotifyStyleDnaReady(settings)) {
    try {
      const analysis = await fetchSpotifyAudioAnalysis(
        hit.id,
        settings.spotifyClientId,
        settings.spotifyClientSecret,
      );
      spotifySections = summarizeSpotifySections(analysis);
    } catch {
      /* optional */
    }
  }

  const baseDna = buildStyleDnaFromHit(hit);
  const fused = fuseStyleDnaWithSonicLayers(baseDna, sonic, acousticbrainz, spotifySections);
  return {
    ...fused.dna,
    confidence: fused.confidence,
    sonic: fused.sonic,
    acousticbrainz: fused.acousticbrainz,
    spotifySections: fused.spotifySections,
    styleTokens: buildStyleDnaFromHit({
      ...hit,
      features: hit.features,
      artistGenres: [...(hit.artistGenres || []), ...(fused.dna.genres || [])],
      tags: hit.tags,
    }).styleTokens,
  };
}

/**
 * Optional YouTube audio sonic layer (requires yt-dlp in sidecar).
 * @param {string} watchUrl
 * @param {object} dna
 * @param {object} hit
 * @param {{ spotifyClientId?: string, spotifyClientSecret?: string }} settings
 */
export async function enrichStyleDnaWithYoutubeSonic(watchUrl, dna, hit, settings) {
  try {
    const sonic = await fetchYoutubeSonicViaSidecar(watchUrl);
    const fused = fuseStyleDnaWithSonicLayers(dna, sonic, null, null);
    return {
      ...fused.dna,
      confidence: fused.confidence,
      sonic: fused.sonic,
      styleTokens: buildStyleDnaFromHit({
        ...hit,
        features: hit.features,
        artistGenres: hit.artistGenres || [],
        tags: hit.tags,
      }).styleTokens,
    };
  } catch {
    return dna;
  }
}
