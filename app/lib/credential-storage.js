/**
 * Optional API credentials stored outside project autosave (localStorage only).
 */

import { LLM_SETTINGS_KEY } from "./co-producer-llm";
import { STYLE_DNA_SETTINGS_KEY } from "./style-dna-settings";
import { safeLocalStorage } from "./safe-local-storage";

export const CREDENTIAL_STORAGE_NOTICE =
  "Co-Producer LLM and Style DNA keys live in browser localStorage only — they are not included in project exports.";

/** Remove optional third-party API keys from localStorage. */
export function clearStoredCredentials() {
  safeLocalStorage.remove(LLM_SETTINGS_KEY);
  safeLocalStorage.remove(STYLE_DNA_SETTINGS_KEY);
}

/** True when any optional credential key has a non-empty secret field. */
export function hasStoredCredentials() {
  const llm = safeLocalStorage.getJSON(LLM_SETTINGS_KEY, null);
  const dna = safeLocalStorage.getJSON(STYLE_DNA_SETTINGS_KEY, null);
  if (String(llm?.apiKey || "").trim()) return true;
  if (String(dna?.spotifyClientSecret || "").trim()) return true;
  if (String(dna?.auddApiToken || "").trim()) return true;
  return false;
}
