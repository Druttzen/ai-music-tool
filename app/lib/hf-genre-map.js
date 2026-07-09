/**
 * Maps Hugging Face genre labels to Suno catalog pills.
 * Default model: dima806/music_genres_classification (wav2vec2, Apache-2.0).
 * Optional: MarekCech/GenreVim-Music-Classification-DistilHuBERT via AIMC_GENRE_MODEL.
 */

import { resolveCatalogTags } from "./analyzer-suggestions";
import { uniq } from "./music-helpers";
import { genreOptions } from "./suno-music-styles";

export const HF_GENRE_MODEL_ID = "dima806/music_genres_classification";
export const HF_DISTILHUBERT_GENRE_MODEL_ID =
  "MarekCech/GenreVim-Music-Classification-DistilHuBERT";

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

/** @type {Record<string, string[]>} DistilHuBERT / extended genre vocabulary */
const DISTILHUBERT_GENRE_TO_SUNO = {
  ...HF_GENRE_TO_SUNO,
  electronic: ["Techno", "House", "Synthwave"],
  edm: ["EDM", "House", "Techno"],
  dance: ["House", "Disco", "EDM"],
  ambient: ["Ambient", "Drone", "Cinematic"],
  folk: ["Folk", "Americana", "Acoustic"],
  soul: ["Soul", "R&B", "Neo-Soul"],
  funk: ["Funk", "Disco", "Soul"],
  punk: ["Punk", "Hard Rock", "Alternative Rock"],
  alternative: ["Alternative Rock", "Indie Rock", "Shoegaze"],
  indie: ["Indie Rock", "Indie Pop", "Dream Pop"],
  trap: ["Trap", "Hip Hop", "Phonk"],
  rnb: ["R&B", "Soul", "Neo-Soul"],
  "r&b": ["R&B", "Soul", "Neo-Soul"],
  latin: ["Latin", "Reggaeton", "Afrobeats"],
  world: ["World", "Afrobeats", "Latin"],
};

function normalizeGenreKey(label) {
  return String(label || "")
    .toLowerCase()
    .replace(/[^a-z0-9+#&]+/g, "");
}

function mapLabelToSuno(label, genreModel) {
  const key = normalizeGenreKey(label);
  const table =
    genreModel && String(genreModel).includes("DistilHuBERT")
      ? DISTILHUBERT_GENRE_TO_SUNO
      : HF_GENRE_TO_SUNO;
  if (table[key]) return table[key];
  for (const [needle, mapped] of Object.entries(table)) {
    if (key.includes(needle) || needle.includes(key)) return mapped;
  }
  return null;
}

/**
 * @param {{ label: string, score: number }[]|null|undefined} predictions
 * @param {{ genreModel?: string|null }} [opts]
 */
export function mapHfGenrePredictionsToSuno(predictions, opts = {}) {
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
    const mapped = mapLabelToSuno(pred.label, opts.genreModel);
    if (mapped) candidates.push(...mapped);
  }

  return {
    suggestedGenres: resolveCatalogTags(uniq(candidates), genreOptions),
    hfGenreLabels: ordered.map((p) => p.label),
    topGenre: ordered[0]?.label ?? null,
    topScore: ordered[0]?.score ?? null,
  };
}
