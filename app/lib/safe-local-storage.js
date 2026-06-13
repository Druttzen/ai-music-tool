/**
 * Safe localStorage helpers — quota errors and corrupt JSON don't crash the app.
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
  return typeof localStorage !== "undefined";
}

export const safeLocalStorage = {
  /**
   * @param {string} key
   * @param {string|null} [fallback]
   */
  get(key, fallback = null) {
    if (!storageAvailable()) return fallback;
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : raw;
    } catch {
      return fallback;
    }
  },

  /**
   * @template T
   * @param {string} key
   * @param {T} fallback
   * @returns {T}
   */
  getJSON(key, fallback) {
    const raw = safeLocalStorage.get(key, null);
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw);
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
      localStorage.setItem(key, value);
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
   * @param {unknown} value
   * @returns {StorageResult}
   */
  setJSON(key, value) {
    return safeLocalStorage.set(key, JSON.stringify(value));
  },

  /**
   * @param {string} key
   * @returns {StorageResult}
   */
  remove(key) {
    if (!storageAvailable()) return { ok: false, reason: "unavailable" };
    try {
      localStorage.removeItem(key);
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

/**
 * @param {StorageResult} result
 * @returns {string|null}
 */
export function storageFailureMessage(result) {
  if (result.ok) return null;
  if (result.reason === "quota") {
    return "Storage full — export JSON and clear history, or reset analyzers";
  }
  if (result.reason === "unavailable") return "Local storage unavailable in this browser";
  return "Could not save locally";
}
