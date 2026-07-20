/**
 * Safe sessionStorage helpers — same API as safeLocalStorage, session-scoped.
 */

/**
 * @typedef {{ ok: true } | { ok: false, reason: "unavailable" | "quota" | "error", message?: string }} StorageResult
 */

function isQuotaError(err) {
  if (!err || typeof err !== "object") return false;
  if (err.name === "QuotaExceededError") return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /quota|too large|exceeded/i.test(msg);
}

function storageAvailable() {
  return typeof sessionStorage !== "undefined";
}

export const safeSessionStorage = {
  /**
   * @param {string} key
   * @param {string|null} [fallback]
   */
  get(key, fallback = null) {
    if (!storageAvailable()) return fallback;
    try {
      const raw = sessionStorage.getItem(key);
      return raw === null ? fallback : raw;
    } catch {
      return fallback;
    }
  },

  /**
   * @param {string} key
   * @param {string} value
   * @returns {StorageResult}
   */
  set(key, value) {
    if (!storageAvailable()) return { ok: false, reason: "unavailable" };
    try {
      sessionStorage.setItem(key, value);
      return { ok: true };
    } catch (err) {
      if (isQuotaError(err)) return { ok: false, reason: "quota" };
      return {
        ok: false,
        reason: "error",
        message: err instanceof Error ? err.message : String(err),
      };
    }
  },

  /**
   * @param {string} key
   * @returns {StorageResult}
   */
  remove(key) {
    if (!storageAvailable()) return { ok: false, reason: "unavailable" };
    try {
      sessionStorage.removeItem(key);
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        reason: "error",
        message: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
