/**
 * Suno-aligned music genres, instruments, and rhythm options.
 * Strong tier: genres Suno handles reliably (v5/v5.5). Extended: fusion / niche / wheel-derived.
 * Full Suno v5.5 genre wheel (900+ fusion phrases) lives in the Style Prompt Library picker.
 */

import { stylePromptCatalog } from "./style-prompt-catalog";
import { sunoV55GenreWheelStyles } from "./suno-v55-genre-wheel";

/** @typedef {{ label: string, group: string, tier?: "strong" | "extended" }} SunoStyleOption */

/** @type {SunoStyleOption[]} */
const GENRE_CATALOG = [
  // Electronic & club
  { label: "Techno", group: "Electronic & club", tier: "strong" },
  { label: "House", group: "Electronic & club", tier: "strong" },
  { label: "Deep House", group: "Electronic & club", tier: "strong" },
  { label: "Tech House", group: "Electronic & club", tier: "strong" },
  { label: "Progressive House", group: "Electronic & club", tier: "strong" },
  { label: "Acid House", group: "Electronic & club", tier: "strong" },
  { label: "Electro House", group: "Electronic & club", tier: "strong" },
  { label: "Melodic House", group: "Electronic & club", tier: "strong" },
  { label: "Minimal Techno", group: "Electronic & club", tier: "strong" },
  { label: "Detroit Techno", group: "Electronic & club", tier: "extended" },
  { label: "Hard Techno", group: "Electronic & club", tier: "extended" },
  { label: "Industrial Techno", group: "Electronic & club", tier: "extended" },
  { label: "Acid Techno", group: "Electronic & club", tier: "extended" },
  { label: "Trance", group: "Electronic & club", tier: "strong" },
  { label: "Psytrance", group: "Electronic & club", tier: "extended" },
  { label: "Goa Trance", group: "Electronic & club", tier: "extended" },
  { label: "Progressive Trance", group: "Electronic & club", tier: "extended" },
  { label: "Drum & Bass", group: "Electronic & club", tier: "strong" },
  { label: "Jungle", group: "Electronic & club", tier: "strong" },
  { label: "Liquid DnB", group: "Electronic & club", tier: "extended" },
  { label: "Neurofunk", group: "Electronic & club", tier: "extended" },
  { label: "Dubstep", group: "Electronic & club", tier: "strong" },
  { label: "Brostep", group: "Electronic & club", tier: "extended" },
  { label: "Riddim", group: "Electronic & club", tier: "extended" },
  { label: "Future Bass", group: "Electronic & club", tier: "strong" },
  { label: "Synthwave", group: "Electronic & club", tier: "strong" },
  { label: "Chillwave", group: "Electronic & club", tier: "strong" },
  { label: "Vaporwave", group: "Electronic & club", tier: "extended" },
  { label: "IDM", group: "Electronic & club", tier: "extended" },
  { label: "Ambient", group: "Electronic & club", tier: "strong" },
  { label: "Ambient Techno", group: "Electronic & club", tier: "extended" },
  { label: "Downtempo", group: "Electronic & club", tier: "strong" },
  { label: "Trip Hop", group: "Electronic & club", tier: "extended" },
  { label: "Breakbeat", group: "Electronic & club", tier: "strong" },
  { label: "Breakcore", group: "Electronic & club", tier: "strong" },
  { label: "Hardstyle", group: "Electronic & club", tier: "extended" },
  { label: "Gabber", group: "Electronic & club", tier: "extended" },
  { label: "Hardcore", group: "Electronic & club", tier: "extended" },
  { label: "Eurodance", group: "Electronic & club", tier: "extended" },
  { label: "EDM", group: "Electronic & club", tier: "strong" },
  { label: "Phonk", group: "Electronic & club", tier: "extended" },
  { label: "UK Garage", group: "Electronic & club", tier: "extended" },
  { label: "Grime", group: "Electronic & club", tier: "extended" },
  { label: "Electro", group: "Electronic & club", tier: "extended" },
  { label: "Industrial", group: "Electronic & club", tier: "strong" },
  { label: "Experimental", group: "Electronic & club", tier: "strong" },
  { label: "New Wave", group: "Electronic & club", tier: "strong" },
  // Hip-hop & R&B
  { label: "Hip Hop", group: "Hip-hop & R&B", tier: "strong" },
  { label: "Trap", group: "Hip-hop & R&B", tier: "strong" },
  { label: "Boom Bap", group: "Hip-hop & R&B", tier: "strong" },
  { label: "Lo-Fi Hip Hop", group: "Hip-hop & R&B", tier: "strong" },
  { label: "Drill", group: "Hip-hop & R&B", tier: "strong" },
  { label: "Cloud Rap", group: "Hip-hop & R&B", tier: "extended" },
  { label: "G-Funk", group: "Hip-hop & R&B", tier: "extended" },
  { label: "R&B", group: "Hip-hop & R&B", tier: "strong" },
  { label: "Neo-Soul", group: "Hip-hop & R&B", tier: "strong" },
  { label: "Contemporary R&B", group: "Hip-hop & R&B", tier: "extended" },
  { label: "Motown", group: "Hip-hop & R&B", tier: "extended" },
  { label: "Funk", group: "Hip-hop & R&B", tier: "strong" },
  { label: "Disco", group: "Hip-hop & R&B", tier: "extended" },
  { label: "Soul", group: "Hip-hop & R&B", tier: "strong" },
  { label: "Afrobeats", group: "Hip-hop & R&B", tier: "extended" },
  // Rock & metal
  { label: "Rock", group: "Rock & metal", tier: "strong" },
  { label: "Classic Rock", group: "Rock & metal", tier: "strong" },
  { label: "Hard Rock", group: "Rock & metal", tier: "extended" },
  { label: "Indie Rock", group: "Rock & metal", tier: "strong" },
  { label: "Alternative Rock", group: "Rock & metal", tier: "strong" },
  { label: "Post-Punk", group: "Rock & metal", tier: "extended" },
  { label: "Punk Rock", group: "Rock & metal", tier: "strong" },
  { label: "Grunge", group: "Rock & metal", tier: "extended" },
  { label: "Shoegaze", group: "Rock & metal", tier: "extended" },
  { label: "Emo", group: "Rock & metal", tier: "extended" },
  { label: "Progressive Rock", group: "Rock & metal", tier: "extended" },
  { label: "Psychedelic Rock", group: "Rock & metal", tier: "extended" },
  { label: "Metal", group: "Rock & metal", tier: "strong" },
  { label: "Heavy Metal", group: "Rock & metal", tier: "strong" },
  { label: "Thrash Metal", group: "Rock & metal", tier: "extended" },
  { label: "Death Metal", group: "Rock & metal", tier: "extended" },
  { label: "Black Metal", group: "Rock & metal", tier: "extended" },
  { label: "Metalcore", group: "Rock & metal", tier: "extended" },
  { label: "Symphonic Metal", group: "Rock & metal", tier: "extended" },
  { label: "Folk Metal", group: "Rock & metal", tier: "strong" },
  { label: "Stoner Rock", group: "Rock & metal", tier: "extended" },
  // Pop & mainstream
  { label: "Pop", group: "Pop & mainstream", tier: "strong" },
  { label: "Indie Pop", group: "Pop & mainstream", tier: "strong" },
  { label: "Synth Pop", group: "Pop & mainstream", tier: "strong" },
  { label: "Dream Pop", group: "Pop & mainstream", tier: "extended" },
  { label: "Electropop", group: "Pop & mainstream", tier: "strong" },
  { label: "K-Pop", group: "Pop & mainstream", tier: "strong" },
  { label: "J-Pop", group: "Pop & mainstream", tier: "extended" },
  { label: "City Pop", group: "Pop & mainstream", tier: "extended" },
  { label: "Hyperpop", group: "Pop & mainstream", tier: "extended" },
  { label: "Dance Pop", group: "Pop & mainstream", tier: "extended" },
  // Jazz & blues
  { label: "Jazz", group: "Jazz & blues", tier: "strong" },
  { label: "Smooth Jazz", group: "Jazz & blues", tier: "strong" },
  { label: "Jazz Fusion", group: "Jazz & blues", tier: "extended" },
  { label: "Bebop", group: "Jazz & blues", tier: "extended" },
  { label: "Swing", group: "Jazz & blues", tier: "strong" },
  { label: "Big Band", group: "Jazz & blues", tier: "extended" },
  { label: "Bossa Nova", group: "Jazz & blues", tier: "extended" },
  { label: "Blues", group: "Jazz & blues", tier: "strong" },
  { label: "Chicago Blues", group: "Jazz & blues", tier: "extended" },
  // Country & folk
  { label: "Country", group: "Country & folk", tier: "strong" },
  { label: "Outlaw Country", group: "Country & folk", tier: "extended" },
  { label: "Bluegrass", group: "Country & folk", tier: "strong" },
  { label: "Folk", group: "Country & folk", tier: "strong" },
  { label: "Indie Folk", group: "Country & folk", tier: "extended" },
  { label: "Folk Rock", group: "Country & folk", tier: "extended" },
  { label: "Americana", group: "Country & folk", tier: "strong" },
  { label: "Celtic", group: "Country & folk", tier: "extended" },
  { label: "Celtic Folk", group: "Country & folk", tier: "extended" },
  { label: "Singer-Songwriter", group: "Country & folk", tier: "extended" },
  { label: "Acoustic", group: "Country & folk", tier: "extended" },
  // Classical & cinematic
  { label: "Classical", group: "Classical & cinematic", tier: "strong" },
  { label: "Orchestral", group: "Classical & cinematic", tier: "strong" },
  { label: "Cinematic", group: "Classical & cinematic", tier: "strong" },
  { label: "Film Score", group: "Classical & cinematic", tier: "extended" },
  { label: "Epic Orchestral", group: "Classical & cinematic", tier: "extended" },
  { label: "Neo-Classical", group: "Classical & cinematic", tier: "extended" },
  { label: "Choral", group: "Classical & cinematic", tier: "extended" },
  // Latin & Caribbean
  { label: "Latin", group: "Latin & Caribbean", tier: "strong" },
  { label: "Reggaeton", group: "Latin & Caribbean", tier: "strong" },
  { label: "Salsa", group: "Latin & Caribbean", tier: "extended" },
  { label: "Bachata", group: "Latin & Caribbean", tier: "extended" },
  { label: "Cumbia", group: "Latin & Caribbean", tier: "extended" },
  { label: "Dembow", group: "Latin & Caribbean", tier: "extended" },
  { label: "Reggae", group: "Latin & Caribbean", tier: "strong" },
  { label: "Dancehall", group: "Latin & Caribbean", tier: "extended" },
  { label: "Ska", group: "Latin & Caribbean", tier: "extended" },
  { label: "Samba", group: "Latin & Caribbean", tier: "extended" },
  { label: "Latin Jazz", group: "Latin & Caribbean", tier: "extended" },
  // World & regional
  { label: "World", group: "World & regional", tier: "strong" },
  { label: "Afrobeat", group: "World & regional", tier: "extended" },
  { label: "Highlife", group: "World & regional", tier: "extended" },
  { label: "Middle Eastern", group: "World & regional", tier: "extended" },
  { label: "Arabic Pop", group: "World & regional", tier: "extended" },
  { label: "Bollywood", group: "World & regional", tier: "extended" },
  { label: "Indian Classical", group: "World & regional", tier: "extended" },
  { label: "Flamenco", group: "World & regional", tier: "extended" },
  { label: "Mariachi", group: "World & regional", tier: "extended" },
  { label: "Pacific Reggae", group: "World & regional", tier: "extended" },
  // Spiritual & specialty
  { label: "Worship", group: "Spiritual & specialty", tier: "strong" },
  { label: "Gospel", group: "Spiritual & specialty", tier: "strong" },
  { label: "Game Music", group: "Spiritual & specialty", tier: "strong" },
  { label: "New Age", group: "Spiritual & specialty", tier: "extended" },
];

/** @type {SunoStyleOption[]} */
const INSTRUMENT_CORE = [
  { label: "808 bass", group: "Bass & low end", tier: "strong" },
  { label: "Heavy sub bass", group: "Bass & low end", tier: "strong" },
  { label: "Distorted bass", group: "Bass & low end", tier: "strong" },
  { label: "Wobble bass", group: "Bass & low end", tier: "strong" },
  { label: "Electric bass", group: "Bass & low end", tier: "strong" },
  { label: "Slap bass", group: "Bass & low end", tier: "extended" },
  { label: "Upright bass", group: "Bass & low end", tier: "extended" },
  { label: "Piano", group: "Keys & piano", tier: "strong" },
  { label: "Concert grand piano", group: "Keys & piano", tier: "extended" },
  { label: "Rhodes electric piano", group: "Keys & piano", tier: "strong" },
  { label: "Wurlitzer electric piano", group: "Keys & piano", tier: "extended" },
  { label: "Hammond organ", group: "Keys & piano", tier: "strong" },
  { label: "Pipe organ", group: "Keys & piano", tier: "extended" },
  { label: "Analog synths", group: "Synths & electronic", tier: "strong" },
  { label: "Bright leads", group: "Synths & electronic", tier: "strong" },
  { label: "Pad synth", group: "Synths & electronic", tier: "strong" },
  { label: "Dark pads", group: "Synths & electronic", tier: "strong" },
  { label: "Supersaw chords", group: "Synths & electronic", tier: "extended" },
  { label: "Chiptune / 8-bit", group: "Synths & electronic", tier: "extended" },
  { label: "Guitar", group: "Guitars & strings", tier: "strong" },
  { label: "Acoustic guitar", group: "Guitars & strings", tier: "strong" },
  { label: "Electric guitar", group: "Guitars & strings", tier: "strong" },
  { label: "Nylon classical guitar", group: "Guitars & strings", tier: "extended" },
  { label: "Pedal steel guitar", group: "Guitars & strings", tier: "extended" },
  { label: "Banjo", group: "Guitars & strings", tier: "extended" },
  { label: "Mandolin", group: "Guitars & strings", tier: "extended" },
  { label: "Ukulele", group: "Guitars & strings", tier: "extended" },
  { label: "Melodic violin", group: "Guitars & strings", tier: "strong" },
  { label: "Orchestral strings", group: "Guitars & strings", tier: "strong" },
  { label: "Subtle strings", group: "Guitars & strings", tier: "strong" },
  { label: "Cello solo", group: "Guitars & strings", tier: "extended" },
  { label: "Harp", group: "Guitars & strings", tier: "strong" },
  { label: "World strings", group: "Guitars & strings", tier: "extended" },
  { label: "Brass section", group: "Brass & winds", tier: "strong" },
  { label: "Trumpet", group: "Brass & winds", tier: "strong" },
  { label: "Trombone", group: "Brass & winds", tier: "extended" },
  { label: "French horn", group: "Brass & winds", tier: "extended" },
  { label: "Dark saxophone", group: "Brass & winds", tier: "strong" },
  { label: "Flute", group: "Brass & winds", tier: "strong" },
  { label: "Clarinet", group: "Brass & winds", tier: "extended" },
  { label: "Oboe", group: "Brass & winds", tier: "extended" },
  { label: "Bagpipes", group: "Brass & winds", tier: "extended" },
  { label: "Big drums", group: "Drums & percussion", tier: "strong" },
  { label: "Soft drums", group: "Drums & percussion", tier: "strong" },
  { label: "Metallic percussion", group: "Drums & percussion", tier: "strong" },
  { label: "Hand percussion", group: "Drums & percussion", tier: "strong" },
  { label: "Tabla", group: "Drums & percussion", tier: "extended" },
  { label: "Djembe", group: "Drums & percussion", tier: "extended" },
  { label: "Congas", group: "Drums & percussion", tier: "extended" },
  { label: "Steel pan", group: "Drums & percussion", tier: "extended" },
  { label: "Timpani", group: "Drums & percussion", tier: "extended" },
  { label: "Choir texture", group: "Vocals & FX", tier: "strong" },
  { label: "Background choir", group: "Vocals & FX", tier: "extended" },
  { label: "Vocal samples", group: "Vocals & FX", tier: "strong" },
  { label: "Beatbox texture", group: "Vocals & FX", tier: "extended" },
  { label: "Arena crowd FX", group: "Vocals & FX", tier: "extended" },
  { label: "DJ scratches", group: "Vocals & FX", tier: "extended" },
  { label: "Sitar", group: "World instruments", tier: "extended" },
  { label: "Didgeridoo", group: "World instruments", tier: "extended" },
  { label: "Koto", group: "World instruments", tier: "extended" },
  { label: "Shamisen", group: "World instruments", tier: "extended" },
  { label: "Erhu", group: "World instruments", tier: "extended" },
  { label: "Bansuri flute", group: "World instruments", tier: "extended" },
  { label: "Steel drums", group: "World instruments", tier: "extended" },
  { label: "Vinyl texture", group: "Production & atmosphere", tier: "strong" },
  { label: "Noise atmosphere", group: "Production & atmosphere", tier: "strong" },
  { label: "Dub delays", group: "Production & atmosphere", tier: "strong" },
  { label: "Glitch FX", group: "Production & atmosphere", tier: "strong" },
  { label: "Side-chain pump", group: "Production & atmosphere", tier: "strong" },
];

/** @type {SunoStyleOption[]} */
const RHYTHM_CATALOG = [
  { label: "4/4", group: "Common grooves" },
  { label: "Breakbeat", group: "Common grooves" },
  { label: "Halftime", group: "Common grooves" },
  { label: "Swing", group: "Common grooves" },
  { label: "Boom Bap", group: "Hip-hop & urban" },
  { label: "Drill groove", group: "Hip-hop & urban" },
  { label: "Trap halftime", group: "Hip-hop & urban" },
  { label: "Rolling", group: "Electronic" },
  { label: "Syncopated", group: "Electronic" },
  { label: "Off-grid", group: "Electronic" },
  { label: "Minimal", group: "Electronic" },
  { label: "No drums", group: "Electronic" },
  { label: "Double-time", group: "Rock & metal" },
  { label: "Half-time rock", group: "Rock & metal" },
  { label: "Tribal", group: "World & Latin" },
  { label: "Shuffle", group: "World & Latin" },
  { label: "Reggae one-drop", group: "World & Latin" },
  { label: "Samba groove", group: "World & Latin" },
  { label: "Bossa groove", group: "World & Latin" },
  { label: "Latin clave", group: "World & Latin" },
  { label: "Dembow bounce", group: "World & Latin" },
  { label: "Garage 2-step", group: "Electronic" },
  { label: "Amen break", group: "Electronic" },
  { label: "Waltz 3/4", group: "Classical & folk" },
  { label: "March 2/4", group: "Classical & folk" },
];

function toPillLabel(phrase) {
  const t = String(phrase || "").trim();
  if (!t) return "";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function dedupeByLabel(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = item.label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function buildGroups(catalog) {
  const map = new Map();
  for (const item of catalog) {
    if (!map.has(item.group)) map.set(item.group, []);
    map.get(item.group).push(item);
  }
  return [...map.entries()].map(([label, items]) => ({ label, items }));
}

/** Catalog lines from style-prompt-catalog instrumentsTextures */
function catalogInstrumentOptions() {
  return (stylePromptCatalog.instrumentsTextures || []).map((line) => ({
    label: toPillLabel(line),
    group: "Catalog instruments",
    tier: "extended",
  }));
}

const INSTRUMENT_CATALOG = dedupeByLabel([
  ...INSTRUMENT_CORE,
  ...catalogInstrumentOptions(),
]);

export const genreOptions = GENRE_CATALOG.map((g) => g.label);
export const soundOptions = INSTRUMENT_CATALOG.map((i) => i.label);
export const rhythmOptions = RHYTHM_CATALOG.map((r) => r.label);

export const SUNO_GENRE_GROUPS = buildGroups(GENRE_CATALOG);
export const SUNO_INSTRUMENT_GROUPS = buildGroups(INSTRUMENT_CATALOG);
export const SUNO_RHYTHM_GROUPS = buildGroups(RHYTHM_CATALOG);

export const SUNO_GENRE_WHEEL_COUNT = sunoV55GenreWheelStyles.length;

export { GENRE_CATALOG as SUNO_GENRE_CATALOG, INSTRUMENT_CATALOG as SUNO_INSTRUMENT_CATALOG };

/**
 * @param {string} query
 * @param {string[]} options
 * @param {string} [groupFilter] — group label or "all"
 * @param {{ label: string, items: { label: string }[] }[]} [groups]
 */
export function filterSunoStyleOptions(query, options, groupFilter = "all", groups) {
  let pool = options;
  if (groups && groupFilter && groupFilter !== "all") {
    const g = groups.find((x) => x.label === groupFilter);
    pool = g ? g.items.map((i) => i.label) : options;
  }
  const q = String(query || "").trim().toLowerCase();
  if (!q) return pool;
  return pool.filter((x) => x.toLowerCase().includes(q));
}
