/**
 * Retrieve licensed Suno style catalog lines for Maestro LLM grounding.
 * Keeps prompts offline-safe — no external retrieval, only local catalog search.
 */

import { matchCatalogOptions } from "./maestro-chat-engine";
import { awesomeSunoConceptLines } from "./awesome-suno-concepts-synced";
import { stylePromptCatalog } from "./style-prompt-catalog";
import { generateMetaphorStyle, metaphorToCatalogHints } from "./metaphor-style";
import { genreOptions, rhythmOptions, soundOptions } from "./suno-music-styles";
import { isEnglishOnlyPromptLine } from "./suno-english-style-index";

const MAX_HINTS = 8;
const MAX_HINT_CHARS = 140;

/** @type {string[]|null} */
let catalogPool = null;

function byLengthDesc(options) {
  return [...options].sort((a, b) => b.length - a.length);
}

function buildSearchHaystack(snapshot, userMessage) {
  return [
    snapshot.idea,
    snapshot.lyricTheme,
    snapshot.lyricStyle,
    snapshot.vocal,
    snapshot.tempo,
    ...(snapshot.selectedGenres || []),
    ...(snapshot.selectedSounds || []),
    ...(snapshot.selectedRhythms || []),
    userMessage,
  ]
    .filter(Boolean)
    .join(" ");
}

/** @param {string} haystack */
function tokenize(haystack) {
  return new Set(
    haystack
      .toLowerCase()
      .split(/[^a-z0-9+#]+/)
      .filter((word) => word.length > 3),
  );
}

function getCatalogPool() {
  if (catalogPool) return catalogPool;
  const lines = [];
  for (const value of Object.values(stylePromptCatalog)) {
    if (Array.isArray(value)) lines.push(...value);
  }
  lines.push(...awesomeSunoConceptLines);
  catalogPool = lines.filter(
    (line) => isEnglishOnlyPromptLine(line) && line.length >= 12 && line.length <= 280,
  );
  return catalogPool;
}

/**
 * @param {string} line
 * @param {Set<string>} tokens
 * @param {string[]} [snapshotGenres]
 */
function scoreCatalogLine(line, tokens, snapshotGenres = []) {
  const lower = line.toLowerCase();
  let score = 0;
  for (const token of tokens) {
    if (lower.includes(token)) score += 2;
  }
  for (const genre of snapshotGenres) {
    const needle = String(genre || "").toLowerCase();
    if (needle && lower.includes(needle)) score += 4;
  }
  return score;
}

/**
 * @param {object} snapshot
 * @param {string} [userMessage]
 * @returns {string[]}
 */
export function retrieveMaestroCatalogHints(snapshot, userMessage = "") {
  const haystack = buildSearchHaystack(snapshot, userMessage);
  const tokens = tokenize(haystack);
  const hints = [];
  const seen = new Set();

  const add = (line) => {
    const text = String(line || "").trim();
    const key = text.toLowerCase();
    if (!text || seen.has(key)) return;
    seen.add(key);
    hints.push(text.length > MAX_HINT_CHARS ? `${text.slice(0, MAX_HINT_CHARS - 1)}…` : text);
  };

  for (const option of matchCatalogOptions(haystack, byLengthDesc(genreOptions), 4)) add(option);
  for (const option of matchCatalogOptions(haystack, byLengthDesc(soundOptions), 4)) add(option);
  for (const option of matchCatalogOptions(haystack, byLengthDesc(rhythmOptions), 2)) add(option);

  const lowerMsg = String(userMessage || "").toLowerCase();
  if (/\b(surprise|random|metaphor|weird|unexpected|roll)\b/.test(lowerMsg)) {
    const metaphor = generateMetaphorStyle();
    add(metaphor.styleLine);
    for (const genre of metaphorToCatalogHints(metaphor).genres) add(genre);
  }

  const ranked = getCatalogPool()
    .map((line) => ({
      line,
      score: scoreCatalogLine(line, tokens, snapshot.selectedGenres),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  for (const { line } of ranked) {
    add(line);
    if (hints.length >= MAX_HINTS) break;
  }

  return hints.slice(0, MAX_HINTS);
}

/**
 * @param {object} snapshot
 * @param {string} [userMessage]
 */
export function formatMaestroCatalogGrounding(snapshot, userMessage = "") {
  const hints = retrieveMaestroCatalogHints(snapshot, userMessage);
  if (!hints.length) return "";
  return [
    "Licensed style catalog hints (use only if relevant; prefer exact catalog names when patching genres/sounds):",
    ...hints.map((hint) => `- ${hint}`),
  ].join("\n");
}

/** @param {Array<{ role: string, text: string }>} history */
export function latestMaestroUserMessage(history) {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const turn = history[i];
    if (turn?.role !== "assistant" && turn?.text) return String(turn.text);
  }
  return "";
}
