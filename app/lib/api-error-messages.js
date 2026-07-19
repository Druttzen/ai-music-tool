/**
 * Turn raw API / HTTP error bodies into short, actionable user messages.
 */

/**
 * @param {unknown} raw
 */
function tryParseJson(raw) {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

/**
 * @param {unknown} body
 */
function messageFromJsonBody(body) {
  if (!body || typeof body !== "object") return "";
  const obj = /** @type {Record<string, unknown>} */ (body);
  const err = obj.error;
  if (err && typeof err === "object") {
    const e = /** @type {Record<string, unknown>} */ (err);
    if (typeof e.message === "string") return e.message;
    if (typeof e.error_message === "string") return e.error_message;
  }
  if (typeof obj.detail === "string") return obj.detail;
  if (Array.isArray(obj.detail) && obj.detail[0]?.msg) return String(obj.detail[0].msg);
  if (typeof obj.message === "string") return obj.message;
  return "";
}

/**
 * @param {string} message
 * @param {number} [status]
 */
export function humanizeApiErrorMessage(message, status) {
  const text = String(message || "").trim();
  const lower = text.toLowerCase();

  // Cursor Bugbot / paid review billing — prefer fail-safe over retrying Bugbot
  if (/failed to run review/i.test(lower) || (/insufficient funds/i.test(lower) && /review/i.test(lower))) {
    return "Automated review could not run (Cursor Bugbot credits) — run npm run fail-safe:auto / in-chat review, or top up Cursor billing.";
  }
  if (/insufficient funds|insufficient_quota|billing|payment required|out of credits|credit balance/i.test(lower)) {
    return "API credits or billing limit reached — check your provider dashboard, add credits, or switch to a local model (Ollama / LM Studio).";
  }
  if (/invalid api key|incorrect api key|unauthorized|authentication/i.test(lower) || status === 401) {
    return "API key rejected — verify the key in Co-Producer / Maestro LLM settings.";
  }
  if (/rate limit|too many requests/i.test(lower) || status === 429) {
    return "Rate limit hit — wait a minute or switch to a different model/provider.";
  }
  if (status === 402) {
    return "Payment required on this API account — add billing or credits at your provider.";
  }

  return text;
}

/**
 * @param {number} status
 * @param {string} rawBody
 * @param {string} context — e.g. "LLM request", "YouTube resolve"
 */
export function formatApiError(status, rawBody, context) {
  const parsed = tryParseJson(rawBody);
  const inner = parsed ? messageFromJsonBody(parsed) : "";
  const base = inner || String(rawBody || "").trim();
  const friendly = humanizeApiErrorMessage(base, status);
  const prefix = context ? `${context} failed` : "Request failed";
  if (friendly && friendly !== base) {
    return `${prefix}: ${friendly}`;
  }
  if (friendly) {
    return `${prefix} (${status}): ${friendly.slice(0, 160)}`;
  }
  return `${prefix} (${status})`;
}

/**
 * @param {unknown} err
 * @param {string} [context]
 */
export function formatThrownApiError(err, context = "Request") {
  if (!(err instanceof Error)) return `${context} failed`;
  const friendly = humanizeApiErrorMessage(err.message);
  return friendly === err.message ? err.message : friendly || err.message;
}
