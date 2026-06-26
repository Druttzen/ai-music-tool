/**
 * Maps Hugging Face GTzan genre labels to Suno catalog pills.
 * Model: dima806/music_genres_classification (wav2vec2, Apache-2.0).
 */

import { resolveCatalogTags } from "./analyzer-suggestions";
import { uniq } from "./music-helpers";
import { genreOptions } from "./suno-music-styles";

export const HF_GENRE_MODEL_ID = "dima806/music_genres_classification";

/** @type {Record<string, string[]>} GTzan id2label keys from the HF model config */
const HF_GENRE_TO_SUNO = {
  disco: ["Disco", "House", "Funk"],
  metal: ["Metal", "Industrial", "Hard Rock"],
  reggae: ["Reggae", "Dub"],
  blues: ["Blues", "Soul", "R&B"],
  rock: ["Rock", "Alternative Rock", "Indie Rock"],
  classical: ["Classical", "Orchestral", "Neo-Classical"],
  jazz: ["Jazz", "Jazz Fusion", "Smooth Jazz"],
  hiphop: ["Hip Hop", "Trap", "Boom Bap"],
  country: ["Country", "Americana", "Folk"],
  pop: ["Pop", "Indie Pop", "Synth Pop"],
};

/**
 * @param {{ label: string, score: number }[]|null|undefined} predictions
 */
export function mapHfGenrePredictionsToSuno(predictions) {
  if (!Array.isArray(predictions) || !predictions.length) {
    return {
      suggestedGenres: [],
      hfGenreLabels: [],
      topGenre: null,
      topScore: null,
    };
  }

  const ordered = [...predictions].sort((a, b) => b.score - a.score);
  const candidates = [];

  for (const pred of ordered) {
    const key = String(pred.label || "")
      .toLowerCase()
      .replace(/\s+/g, "");
    const mapped = HF_GENRE_TO_SUNO[key];
    if (mapped) candidates.push(...mapped);
  }

  return {
    suggestedGenres: resolveCatalogTags(uniq(candidates), genreOptions),
    hfGenreLabels: ordered.map((p) => p.label),
    topGenre: ordered[0]?.label ?? null,
    topScore: ordered[0]?.score ?? null,
  };
}
