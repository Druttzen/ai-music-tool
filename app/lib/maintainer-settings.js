/**
 * Maintainer settings for in-app fail-safe fix + push.
 * GitHub PAT is kept in sessionStorage only (not localStorage) to limit XSS persistence.
 */

import { safeLocalStorage } from "./safe-local-storage";
import { safeSessionStorage } from "./safe-session-storage";

export const MAINTAINER_GITHUB_TOKEN_KEY = "aimc.maintainer.githubToken";

function migrateLegacyLocalToken() {
  const legacy = safeLocalStorage.get(MAINTAINER_GITHUB_TOKEN_KEY, "")?.trim() || "";
  if (!legacy) return "";
  safeSessionStorage.set(MAINTAINER_GITHUB_TOKEN_KEY, legacy);
  safeLocalStorage.remove(MAINTAINER_GITHUB_TOKEN_KEY);
  return legacy;
}

export function getMaintainerGithubToken() {
  const fromSession = safeSessionStorage.get(MAINTAINER_GITHUB_TOKEN_KEY, "")?.trim() || "";
  if (fromSession) return fromSession;
  return migrateLegacyLocalToken();
}

export function setMaintainerGithubToken(token) {
  const value = String(token || "").trim();
  // Always clear any legacy localStorage copy.
  safeLocalStorage.remove(MAINTAINER_GITHUB_TOKEN_KEY);
  if (!value) {
    safeSessionStorage.remove(MAINTAINER_GITHUB_TOKEN_KEY);
    return { ok: true };
  }
  return safeSessionStorage.set(MAINTAINER_GITHUB_TOKEN_KEY, value);
}

export function hasMaintainerGithubToken() {
  return !!getMaintainerGithubToken();
}

export function clearMaintainerGithubToken() {
  safeLocalStorage.remove(MAINTAINER_GITHUB_TOKEN_KEY);
  return safeSessionStorage.remove(MAINTAINER_GITHUB_TOKEN_KEY);
}
