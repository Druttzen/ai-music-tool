/**
 * Fuse metadata Style-DNA with audio sonic signature + archive layers.
 */

import { formatSpotifyKey } from "./track-style-dna";

/**
 * @param {object} dna
 * @param {object|null} sonic
 * @param {object|null} acousticbrainz
 * @param {object|null} spotifySections
 */
export function fuseStyleDnaWithSonicLayers(dna, sonic, acousticbrainz, spotifySections) {
  const fused = { ...dna };
  const confidence = buildConfidenceScores(dna, sonic, acousticbrainz, spotifySections);

  if (sonic?.tempo_bpm) {
    fused.tempo = `${Math.round(sonic.tempo_bpm)} BPM`;
    fused.tempoSource = "audio";
  } else if (acousticbrainz?.bpm) {
    fused.tempo = `${Math.round(acousticbrainz.bpm)} BPM`;
    fused.tempoSource = "acousticbrainz";
  }

  if (sonic?.key_estimate) {
    fused.estimatedKey = sonic.key_estimate;
    fused.keySource = "audio";
  } else if (acousticbrainz?.key_key) {
    fused.estimatedKey = formatSpotifyKey(
      pitchClassFromName(acousticbrainz.key_key),
      acousticbrainz.key_scale === "major" ? 1 : 0,
    );
    fused.keySource = "acousticbrainz";
  }

  if (acousticbrainz?.genres?.length) {
    fused.genres = [...new Set([...(fused.genres || []), ...acousticbrainz.genres])].slice(0, 6);
  }
  if (acousticbrainz?.moods?.length) {
    fused.moodWords = [...new Set([...(fused.moodWords || []), ...acousticbrainz.moods])].slice(0, 5);
  }

  if (sonic?.chord_progression?.length) {
    fused.chordProgression = sonic.chord_progression.map((c) => c.chord).slice(0, 12);
  }

  if (spotifySections?.labels?.length) {
    fused.structureFromSections = spotifySections.labels.filter((l, i, a) => !i || l !== a[i - 1]).join(" → ");
  }

  return { dna: fused, confidence, sonic, acousticbrainz, spotifySections };
}

/**
 * @param {object} dna
 * @param {object|null} sonic
 * @param {object|null} acousticbrainz
 * @param {object|null} spotifySections
 */
export function buildConfidenceScores(dna, sonic, acousticbrainz, spotifySections) {
  const level = (score) => (score >= 0.7 ? "high" : score >= 0.4 ? "medium" : "low");

  const bpmScore = sonic?.tempo_bpm
    ? 0.9
    : acousticbrainz?.bpm
      ? 0.65
      : dna?.features?.tempo
        ? 0.5
        : 0.2;

  const keyScore = sonic?.key_confidence
    ? Math.min(0.95, sonic.key_confidence + 0.15)
    : acousticbrainz?.key_strength
      ? Number(acousticbrainz.key_strength)
      : dna?.features?.key != null
        ? 0.45
        : 0.15;

  const genreBase = (dna?.genres?.length || 0) >= 2 ? 0.7 : (dna?.genres?.length || 0) === 1 ? 0.45 : 0.2;
  const genreFinal = acousticbrainz?.genres?.length ? 0.75 : genreBase;

  const structureScore = spotifySections?.labels?.length
    ? 0.8
    : sonic?.timeline_segments?.length
      ? 0.55
      : 0.25;

  return {
    bpm: { level: level(bpmScore), score: bpmScore, source: sonic ? "audio" : acousticbrainz?.bpm ? "archive" : "metadata" },
    key: { level: level(keyScore), score: keyScore, source: sonic ? "audio" : acousticbrainz ? "archive" : "metadata" },
    genre: { level: level(genreFinal), score: genreFinal, source: acousticbrainz?.genres?.length ? "archive" : "metadata" },
    structure: { level: level(structureScore), score: structureScore, source: spotifySections ? "spotify-sections" : sonic ? "audio-timeline" : "duration-guess" },
    chords: {
      level: sonic?.chord_progression?.length >= 4 ? "medium" : sonic?.chord_progression?.length ? "low" : "none",
      count: sonic?.chord_progression?.length || 0,
    },
  };
}

/**
 * @param {string} name
 */
function pitchClassFromName(name) {
  const map = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };
  return map[String(name || "").trim()] ?? null;
}

/**
 * @param {object} confidence
 */
export function formatConfidenceBadge(confidence) {
  if (!confidence) return "";
  const parts = [
    `BPM: ${confidence.bpm?.level || "?"}`,
    `key: ${confidence.key?.level || "?"}`,
    `genre: ${confidence.genre?.level || "?"}`,
    `structure: ${confidence.structure?.level || "?"}`,
  ];
  if (confidence.chords?.count) parts.push(`chords: ${confidence.chords.count}`);
  return parts.join(" · ");
}
