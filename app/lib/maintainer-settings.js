/**
 * Maintainer settings for in-app fail-safe fix + push (localStorage only).
 */

import { safeLocalStorage } from "./safe-local-storage";

export const MAINTAINER_GITHUB_TOKEN_KEY = "aimc.maintainer.githubToken";

export function getMaintainerGithubToken() {
  return safeLocalStorage.get(MAINTAINER_GITHUB_TOKEN_KEY, "")?.trim() || "";
}

export function setMaintainerGithubToken(token) {
  const value = String(token || "").trim();
  if (!value) {
    safeLocalStorage.remove(MAINTAINER_GITHUB_TOKEN_KEY);
    return { ok: true };
  }
  return safeLocalStorage.set(MAINTAINER_GITHUB_TOKEN_KEY, value);
}

export function hasMaintainerGithubToken() {
  return !!getMaintainerGithubToken();
}
