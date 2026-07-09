/**
 * Lazy-load the synced Suno catalog chunk (dynamic import).
 */

/** @type {import("./suno-catalog-synced.js").SUNO_CATALOG_SYNC | null} */
let syncCache = null;
/** @type {Promise<typeof syncCache> | null} */
let loadPromise = null;

/**
 * @returns {Promise<NonNullable<typeof syncCache>>}
 */
export function loadSunoCatalogSync() {
  if (syncCache) return Promise.resolve(syncCache);
  if (loadPromise) return loadPromise;
  loadPromise = import("./suno-catalog-synced.js").then((mod) => {
    syncCache = mod.SUNO_CATALOG_SYNC;
    return syncCache;
  });
  return loadPromise;
}

/** @returns {typeof syncCache} */
export function getSunoCatalogSyncCached() {
  return syncCache;
}

/** Fire-and-forget preload for panels that merge synced vocabulary. */
export function preloadSunoCatalogSync() {
  void loadSunoCatalogSync();
}
