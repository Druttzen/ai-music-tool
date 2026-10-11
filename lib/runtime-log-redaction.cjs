/** Shared credential masking for the browser queue and final CLI delivery. */
function redactRuntimeText(text) {
  return String(text || "")
    .replace(/\b(?:github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{12,})\b/g, "[redacted-token]")
    .replace(/\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,}\b/g, "[redacted-token]")
    .replace(/\b((?:Proxy-)?Authorization)["']?\s*[:=]\s*["']?(?:Bearer|Basic|Token)\s+[^\s"',;}]+/gi, "$1=[redacted]")
    .replace(/\b(AIMC_GITHUB_TOKEN|GITHUB_TOKEN|Authorization|Proxy-Authorization|X-API-Key|API_KEY|apiKey)["']?\s*[:=]\s*["']?[^\s"',;}]+/gi, "$1=[redacted]");
}

function sanitizeRuntimeValue(value, redact = redactRuntimeText) {
  if (typeof value === "string") return redact(value);
  if (Array.isArray(value)) return value.map((item) => sanitizeRuntimeValue(item, redact));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      key,
      /^(?:(?:proxy-)?authorization|(?:aimc_|github_|gh_)?token|(?:x[-_])?api[-_]?key|password|secret)$/i.test(key)
        ? "[redacted]" : sanitizeRuntimeValue(item, redact),
    ]));
  }
  return value;
}

module.exports = { redactRuntimeText, sanitizeRuntimeValue };
