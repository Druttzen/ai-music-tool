/**
 * Wrap studio functions so thrown errors are captured and do not take down the UI.
 * Does not change successful return values. GitHub reporting stays opt-in.
 */

import { reportCaughtError } from "./fail-safe-runtime-capture.js";

/**
 * Run fn; on throw / rejection, record a fault and return fallback.
 * @param {() => unknown} fn
 * @param {string} source
 * @param {unknown} [fallback]
 */
export function failSafeCall(fn, source, fallback) {
  try {
    const result = fn();
    if (result && typeof result.then === "function") {
      return Promise.resolve(result).catch((error) => {
        reportCaughtError(source, error);
        return fallback;
      });
    }
    return result;
  } catch (error) {
    reportCaughtError(source, error);
    return fallback;
  }
}

/**
 * @param {Function} fn
 * @param {string} source
 * @param {unknown} [fallback]
 */
export function failSafeFn(fn, source, fallback) {
  const name = source || fn?.name || "fn";
  return function failSafeWrapped(...args) {
    return failSafeCall(() => fn.apply(this, args), name, fallback);
  };
}

/**
 * Wrap function values on an object; pass through non-functions.
 * @template {Record<string, unknown>} T
 * @param {T} handlers
 * @param {string} prefix
 * @returns {T}
 */
export function failSafeWrapHandlers(handlers, prefix) {
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [key, value] of Object.entries(handlers || {})) {
    if (typeof value !== "function") {
      out[key] = value;
      continue;
    }
    out[key] = failSafeFn(value, `${prefix}.${key}`);
  }
  return /** @type {T} */ (out);
}
