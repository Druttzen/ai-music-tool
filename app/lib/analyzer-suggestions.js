/**
 * Catalog-aware analyzer suggestions — maps heuristics to Suno genre/instrument/rhythm pills.
 */

import { genreOptions, rhythmOptions, soundOptions } from "./suno-music-styles";
import { uniq } from "./music-helpers";

const GENRE_SET = new Set(genreOptions.map((g) => g.toLowerCase()));
const SOUND_SET = new Set(soundOptions.map((s) => s.toLowerCase()));
const RHYTHM_SET = new Set(rhythmOptions.map((r) => r.toLowerCase()));

/** @param {string} label @param {string[]} catalog */
export function resolveCatalogLabel(label, catalog) {
  const raw = String(label || "").trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (catalog.some((c) => c.toLowerCase() === lower)) {
    return catalog.find((c) => c.toLowerCase() === lower);
  }
  const partial = catalog.find(
    (c) => c.toLowerCase().includes(lower) || lower.includes(c.toLowerCase()),
  );
  return partial || null;
}

/** @param {string[]} tags @param {string[]} catalog */
export function resolveCatalogTags(tags, catalog) {
  const out = [];
  for (const tag of tags || []) {
    const hit = resolveCatalogLabel(tag, catalog);
    if (hit && !out.includes(hit)) out.push(hit);
  }
  return out;
}

/**
 * @param {object} metrics
 * @param {number} metrics.energy
 * @param {number} metrics.aggression
 * @param {number} metrics.brightness
 * @param {number} metrics.darkness
 * @param {number} metrics.complexity
 * @param {number|null} metrics.bpm
 * @param {number} metrics.centroidHz
 */
export function buildAudioAnalyzerSuggestions(metrics) {
  const { energy, aggression, brightness, darkness, complexity, bpm, centroidHz } = metrics;
  const genreCandidates = [];
  const subgenreCandidates = [];
  const soundCandidates = [];
  const instrumentCandidates = [];
  const rhythmCandidates = [];
  const moodCandidates = [];

  if (bpm >= 165) {
    genreCandidates.push("Drum & Bass", "Jungle", "Breakcore");
    rhythmCandidates.push("Breakbeat", "Rolling");
    soundCandidates.push("Heavy sub bass", "Dub delays", "Glitch FX");
  } else if (bpm >= 128) {
    genreCandidates.push("Techno", "House", "Trance", "EDM");
    rhythmCandidates.push("4/4", "Rolling");
    soundCandidates.push("Heavy sub bass", "Analog synths", "Side-chain pump");
  } else if (bpm >= 100) {
    genreCandidates.push("Hip Hop", "Pop", "R&B", "Reggaeton");
    rhythmCandidates.push("Boom Bap", "Syncopated");
    soundCandidates.push("808 bass", "Soft drums", "Rhodes electric piano");
  } else if (bpm > 0 && bpm < 100) {
    genreCandidates.push("Ambient", "Downtempo", "Cinematic", "Lo-Fi Hip Hop");
    rhythmCandidates.push("Minimal", "Halftime");
    soundCandidates.push("Dark pads", "Vinyl texture", "Piano");
  }

  if (energy > 65 && aggression > 55) {
    genreCandidates.push("Techno", "Industrial", "Hard Techno");
    subgenreCandidates.push("Peak-time", "Club");
    moodCandidates.push("Driving", "Intense");
    soundCandidates.push("Heavy sub bass", "Big drums", "Metallic percussion");
    rhythmCandidates.push("4/4", "Syncopated");
  } else if (energy < 40 && darkness > 55) {
    genreCandidates.push("Ambient", "Cinematic", "Neo-Classical");
    subgenreCandidates.push("Atmospheric", "Drone");
    moodCandidates.push("Calm", "Mysterious");
    soundCandidates.push("Dark pads", "Noise atmosphere", "Orchestral strings");
    rhythmCandidates.push("Minimal", "No drums");
  } else {
    genreCandidates.push("Pop", "Indie Pop", "Electronic");
    subgenreCandidates.push("Modern", "Hybrid");
    moodCandidates.push("Balanced", "Focused");
    soundCandidates.push("Analog synths", "Soft drums", "Pad synth");
    rhythmCandidates.push("4/4");
  }

  if (aggression > 70) {
    genreCandidates.push("Metal", "Dubstep", "Drill");
    soundCandidates.push("Distorted bass", "Wobble bass", "808 bass");
    rhythmCandidates.push("Halftime", "Drill groove");
  }
  if (brightness > 58) {
    genreCandidates.push("Synth Pop", "Future Bass");
    soundCandidates.push("Bright leads", "Supersaw chords", "Glitch FX");
    moodCandidates.push("Bright");
  }
  if (darkness > 65 && energy > 45) {
    genreCandidates.push("Synthwave", "Post-Punk");
    soundCandidates.push("Dark saxophone", "Dark pads");
  }
  if (complexity > 60) {
    genreCandidates.push("Jazz Fusion", "Experimental", "IDM");
    rhythmCandidates.push("Breakbeat", "Off-grid", "Swing");
    soundCandidates.push("Glitch FX", "Hand percussion");
  }
  if (bpm && bpm > 128) subgenreCandidates.push("Uptempo");
  if (bpm && bpm < 95) subgenreCandidates.push("Downtempo");

  if (centroidHz > 2800 && energy > 45) {
    instrumentCandidates.push("Vocal samples", "Background choir");
  } else if (energy < 30 && aggression < 40) {
    instrumentCandidates.push("Pad synth", "Orchestral strings");
  }

  const vocals =
    centroidHz > 2800 && energy > 45
      ? "Vocals likely"
      : energy < 30 && aggression < 40
        ? "Instrumental likely"
        : "Mixed / uncertain";

  return {
    suggestedGenres: resolveCatalogTags(genreCandidates, genreOptions),
    suggestedSubgenres: uniq(subgenreCandidates.filter(Boolean)),
    suggestedMoods: uniq(moodCandidates),
    suggestedInstruments: resolveCatalogTags(instrumentCandidates, soundOptions),
    suggestedSounds: resolveCatalogTags(soundCandidates, soundOptions),
    suggestedRhythms: resolveCatalogTags(rhythmCandidates, rhythmOptions),
    vocals,
  };
}

/**
 * @param {object} visual
 * @param {boolean} visual.dark
 * @param {boolean} visual.cool
 * @param {boolean} visual.warm
 * @param {boolean} visual.bright
 * @param {boolean} visual.vivid
 * @param {boolean} visual.highContrast
 */
export function buildImagePaletteSuggestions(visual) {
  const { dark, cool, warm, vivid, bright, highContrast } = visual;
  const genreCandidates = [];
  const soundCandidates = [];
  const rhythmCandidates = [];

  if (dark && highContrast) {
    genreCandidates.push("Industrial", "Techno", "Metal", "Detroit Techno");
    soundCandidates.push("Metallic percussion", "Distorted bass", "Noise atmosphere");
    rhythmCandidates.push("4/4", "Syncopated");
  }
  if (cool) {
    genreCandidates.push("Ambient", "Cinematic", "Synthwave");
    soundCandidates.push("Dark pads", "Dub delays", "Pad synth");
    rhythmCandidates.push("Minimal", "Halftime");
  }
  if (warm && vivid) {
    genreCandidates.push("House", "Pop", "Reggaeton", "Funk");
    soundCandidates.push("Bright leads", "Big drums", "Hand percussion");
    rhythmCandidates.push("4/4", "Latin clave");
  }
  if (bright && !vivid) {
    genreCandidates.push("Ambient", "Orchestral", "Classical", "Neo-Classical");
    soundCandidates.push("Piano", "Orchestral strings", "Soft drums", "Harp");
    rhythmCandidates.push("Minimal", "Waltz 3/4");
  }
  if (vivid && highContrast) {
    genreCandidates.push("Experimental", "Hyperpop", "Psytrance");
    soundCandidates.push("Glitch FX", "Analog synths", "Supersaw chords");
    rhythmCandidates.push("Off-grid", "Breakbeat");
  }
  if (!genreCandidates.length) {
    genreCandidates.push("Experimental", "Ambient");
    soundCandidates.push("Analog synths", "Dark pads");
    rhythmCandidates.push("Minimal");
  }

  return {
    suggestedGenres: resolveCatalogTags(genreCandidates, genreOptions),
    suggestedSounds: resolveCatalogTags(soundCandidates, soundOptions),
    suggestedRhythms: resolveCatalogTags(rhythmCandidates, rhythmOptions),
  };
}

/** @param {string} label */
export function isCatalogGenre(label) {
  return GENRE_SET.has(String(label || "").toLowerCase());
}

export function isCatalogSound(label) {
  return SOUND_SET.has(String(label || "").toLowerCase());
}

export function isCatalogRhythm(label) {
  return RHYTHM_SET.has(String(label || "").toLowerCase());
}
