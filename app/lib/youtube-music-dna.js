/**
 * YouTube URL → track Style-DNA + Suno 5.5 replication pack.
 */

import { buildStyleDnaFromHit, compactStyleDnaRule, searchTrackStyleDna } from "./track-style-dna";
import { resolveYoutubeReference } from "./youtube-reference";
import { generateSunoMetatagScaffold } from "./suno-metatag-generator";
import { formatConfidenceBadge } from "./sonic-signature-fusion";
import { buildUdioProsePrompt } from "./udio-prose-export";
import { enrichStyleDnaHit, enrichStyleDnaWithYoutubeSonic } from "./style-dna-enrich";

const OFFICIAL_SUFFIX =
  /\s*[\(\[]?(official\s*(music\s*)?video|audio|lyric|mv|hd|4k|remaster(?:ed)?|visualizer|live|topic).*$/i;

/**
 * @param {string} rawTitle
 */
export function parseYoutubeMusicTitle(rawTitle) {
  const cleaned = String(rawTitle || "")
    .replace(OFFICIAL_SUFFIX, "")
    .trim();
  if (!cleaned) return { artist: "", track: "", searchQuery: "" };

  for (const sep of [" - ", " – ", " — ", " | ", ": "]) {
    const idx = cleaned.indexOf(sep);
    if (idx > 0) {
      const artist = cleaned.slice(0, idx).trim();
      const track = cleaned.slice(idx + sep.length).trim();
      if (artist && track) {
        return { artist, track, searchQuery: `${artist} ${track}`.trim() };
      }
    }
  }

  return { artist: "", track: cleaned, searchQuery: cleaned };
}

/**
 * @param {number|null|undefined} durationSec
 */
export function inferSunoStructureFromDuration(durationSec) {
  const sec = Number(durationSec);
  if (!sec || sec < 30) return "intro → verse → chorus → verse → chorus → outro";
  if (sec < 90) return "intro → verse → chorus → verse → chorus → outro";
  if (sec < 150) return "intro → verse → chorus → verse → chorus → bridge → chorus → outro";
  if (sec < 240) return "intro → verse → pre-chorus → chorus → verse → pre-chorus → chorus → bridge → chorus → outro";
  return "intro → verse → chorus → verse → chorus → bridge → extended chorus → outro";
}

/**
 * @param {object} dna
 */
function inferVocalTripleStack(dna) {
  const role = String(dna.vocalRole || "").toLowerCase();
  if (role.includes("rap")) return ["rhythmic rap vocal", "confident delivery", "dry close-mic"];
  if (role.includes("instrumental")) return [];
  if (dna.moodWords?.includes("dark")) {
    return ["expressive lead vocal", "intimate verses belted chorus", "plate reverb tail"];
  }
  return ["polished lead vocal", "emotive phrasing", "studio close-mic"];
}

/**
 * @param {object} dna
 * @param {object} [youtube]
 */
export function buildSunoReplicationPack(dna, youtube = {}) {
  const vocalStack = inferVocalTripleStack(dna);
  const styleParts = [
    ...dna.genres.slice(0, 2),
    dna.tempo,
    dna.estimatedKey,
    ...vocalStack,
    ...dna.sounds.slice(0, 4),
    ...dna.rhythms.slice(0, 2),
    ...(dna.moodWords || []).slice(0, 3),
    dna.featureSummary ? `ref mix ${dna.featureSummary}` : "",
    "genre-faithful arrangement",
    "no impersonation",
  ].filter(Boolean);

  const styleLine = styleParts.join(", ").slice(0, 980);
  const structure =
    dna.structureFromSections ||
    inferSunoStructureFromDuration(youtube.durationSec);
  const lyricsMetatag = generateSunoMetatagScaffold({
    structure,
    moodWords: dna.moodWords,
    title: dna.title,
    artist: dna.artist,
  });

  return {
    styleLine,
    lyricsMetatag,
    structure,
    ruleLine: compactStyleDnaRule(dna),
    ideaLine: `Recreate the feel of ${dna.artist} — ${dna.title}${youtube.parsedTrack ? ` (${youtube.parsedTrack})` : ""} for Suno 5.5 — match tempo, key, groove, and vocal lane.`,
    excludeHints: "no random genre drift, no spoken word unless original is rap",
    udioProse: buildUdioProsePrompt(dna, {
      reference: `${dna.artist} — ${dna.title}`,
    }),
    confidenceBadge: formatConfidenceBadge(dna.confidence),
    chordStrip: (dna.chordProgression || []).join(" → "),
    dna,
    youtube,
  };
}

/**
 * @param {string} url
 * @param {{ spotifyClientId?: string, spotifyClientSecret?: string }} settings
 */
export async function resolveYoutubeMusicDna(url, settings) {
  const youtube = await resolveYoutubeReference(url);
  if (!youtube?.watchUrl) {
    throw new Error("Invalid YouTube URL");
  }

  const parsed =
    youtube.parsedArtist || youtube.parsedTrack
      ? {
          artist: youtube.parsedArtist || "",
          track: youtube.parsedTrack || youtube.title,
          searchQuery: youtube.searchQuery || youtube.title,
        }
      : parseYoutubeMusicTitle(youtube.title);

  const queries = [
    parsed.searchQuery,
    parsed.artist && parsed.track ? `${parsed.artist} ${parsed.track}` : "",
    youtube.title,
    youtube.authorName && parsed.track ? `${youtube.authorName} ${parsed.track}` : "",
  ].filter((q, i, arr) => q && arr.indexOf(q) === i);

  let lastError = null;
  /** @type {import("./track-style-dna").buildStyleDnaFromHit | null} */
  let bestDna = null;
  /** @type {object|null} */
  let searchResult = null;

  for (const q of queries) {
    try {
      const out = await searchTrackStyleDna(q, settings);
      if (out.mapped?.length) {
        searchResult = out;
        bestDna = out.mapped[0];
        break;
      }
    } catch (err) {
      lastError = err;
    }
  }

  if (!bestDna) {
    throw lastError instanceof Error ? lastError : new Error("No matching track DNA found for this YouTube link");
  }

  const hit = searchResult?.hits?.[0];
  if (hit) {
    bestDna = await enrichStyleDnaHit(hit, null, settings);
    if (youtube.watchUrl) {
      bestDna = await enrichStyleDnaWithYoutubeSonic(youtube.watchUrl, bestDna, hit, settings);
    }
  }

  if (youtube.tags?.length && bestDna.genres.length < 3) {
    bestDna = {
      ...bestDna,
      genres: [...new Set([...bestDna.genres, ...youtube.tags.slice(0, 4)])],
    };
    bestDna.styleTokens = buildStyleDnaFromHit({
      ...(searchResult.hits[0] || {}),
      artistGenres: [...(searchResult.hits[0]?.artistGenres || []), ...youtube.tags],
      tags: [...(searchResult.hits[0]?.tags || []), ...youtube.tags],
      features: searchResult.hits[0]?.features || null,
      title: bestDna.title,
      artist: bestDna.artist,
    }).styleTokens;
  }

  const replication = buildSunoReplicationPack(bestDna, youtube);

  return {
    youtube,
    parsed,
    provider: searchResult?.provider || "unknown",
    hits: searchResult?.hits || [],
    dna: bestDna,
    replication,
  };
}
