/** Session-backed Maestro draft prefill (survives panel mount timing). */

const MAESTRO_PREFILL_KEY = "aimc_maestro_prefill_pending";

export function readPendingMaestroPrefill() {
  if (typeof window === "undefined") return "";
  try {
    const pending = window.sessionStorage.getItem(MAESTRO_PREFILL_KEY);
    if (pending) {
      window.sessionStorage.removeItem(MAESTRO_PREFILL_KEY);
      return String(pending);
    }
  } catch {
    /* ignore */
  }
  return "";
}

export function queueMaestroPrefill(prompt) {
  if (typeof window === "undefined" || !prompt) return;
  const text = String(prompt);
  try {
    window.sessionStorage.setItem(MAESTRO_PREFILL_KEY, text);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent("aimc-maestro-prefill", { detail: { prompt: text } }));
}
