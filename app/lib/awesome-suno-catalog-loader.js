/**
 * Lazy-load the large CC0 awesome-suno catalog chunk (dynamic import).
 */

/** @type {string[]|null} */
let linesCache = null;
/** @type {Record<string, string>|null} */
let tagsCache = null;
/** @type {Promise<{ lines: string[], tags: Record<string, string> }>|null} */
let loadPromise = null;

/**
 * @returns {Promise<{ lines: string[], tags: Record<string, string> }>}
 */
export function loadAwesomeSunoCatalog() {
  if (linesCache && tagsCache) {
    return Promise.resolve({ lines: linesCache, tags: tagsCache });
  }
  if (loadPromise) return loadPromise;
  loadPromise = import("./awesome-suno-concepts-synced.js").then((mod) => {
    linesCache = mod.awesomeSunoConceptLines;
    tagsCache = mod.awesomeSunoConceptTags;
    return { lines: linesCache, tags: tagsCache };
  });
  return loadPromise;
}

/** @returns {string[]} */
export function getAwesomeSunoConceptLinesSync() {
  return linesCache || [];
}

/** @returns {Record<string, string>} */
export function getAwesomeSunoConceptTagsSync() {
  return tagsCache || {};
}

/** Fire-and-forget preload for Maestro / picker warm-up. */
export function preloadAwesomeSunoCatalog() {
  void loadAwesomeSunoCatalog();
}
